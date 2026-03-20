---
tags:
  - domain:runtime
  - status:canonical
  - format:spec
  - feature:failure-model
created: 2026-02-26
updated: 2026-02-26
tier: 1
title: "BLOOM Runtime: Модель збоїв V1"
dg-publish: true
---

# BLOOM Runtime: Failure Model V1

> Created: 2026-02-26
> Updated: 2026-02-26
> Author: architect
> Status: canonical
> Узгоджено з: INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §6.3, ІНТЕГРАЦІЯ_MEMBRIDGE §8, JOB_QUEUE_ТА_ARTIFACT_MODEL §1

---

## 1. Failure Taxonomy

### 1.1 Node Failures

| Сценарій | Детекція | Автоматична дія | Ручна дія |
|----------|----------|-----------------|-----------|
| Node offline (crash, reboot) | Lease expires (reaper кожні 15с) | Task requeue (якщо attempts < max) | Перевірити ноду |
| Node unreachable (network) | Dispatch → connection refused / timeout | 502 error; task залишається queued | Перевірити мережу |
| Node degraded (high CPU/memory) | Health check → degraded status | Зменшити routing priority | Моніторинг |
| Agent crash (port 8001 down) | Agent health check → unreachable | Worker → offline; no routing | `agent-restart` |

### 1.2 Claude / LLM Failures

Узгоджено з `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §6.3`:

| Сценарій | Детекція | Автоматична дія | Fallback |
|----------|----------|-----------------|----------|
| Claude CLI not found | Node health: `claude_cli: false` | Не routing на цю ноду | Інша нода |
| Claude rate limited (429) | Error result з `rate_limited` | Exponential backoff → retry | Інша нода |
| Claude API error (500/503) | Error result з `provider_error` | Retry на тій самій ноді (1x) | Інша нода після 2 failures |
| Claude timeout | No output after `policy.timeout_sec` | Worker kills process; error result | Retry з більшим timeout |
| Partial output (timeout) | Worker captures partial before kill | Зберігає `partial_output` | Оператор вирішує |
| Budget exceeded | Worker detects token limit | Error result з `budget_exceeded` | **Не retry** (terminal) |
| Invalid response format | Worker can't parse output | Error result з `parse_error` | Retry (Claude may fix) |
| Invalid prompt / context | Worker reports invalid input | Mark failed immediately | Fix prompt |

### 1.3 Infrastructure Failures

Узгоджено з `ІНТЕГРАЦІЯ_MEMBRIDGE §8`:

| Сценарій | Детекція | Автоматична дія |
|----------|----------|-----------------|
| PostgreSQL down | Storage operations fail | Server starts without persistence; log warning |
| MinIO down | Artifact upload fails | Fallback: store in PostgreSQL |
| Membridge CP down | Proxy 502; workerSync fails silently | Use cached worker list; log warning |
| Runtime restart | All in-memory state lost | Restore from PostgreSQL; stale leases expire |
| Primary node offline | Leadership lease expired | `needs_ui_selection: true`; operator promotes new primary |

---

## 2. Retry & Backoff Policy

### 2.1 Task-level retry

```
Attempt 1: immediate dispatch
  ↓ fail
Attempt 2: delay = base_delay_sec (15s)
  ↓ fail
Attempt 3: delay = base_delay_sec * 2 (30s)
  ↓ fail
→ status: "dead" (потребує ручного requeue)
```

### 2.2 Retry Decision Matrix

| Помилка | Retry? | На тій самій ноді? | Примітка |
|---------|--------|---------------------|----------|
| Timeout | Так | Так (1x), потім інша | Збільшити timeout? |
| Rate limited | Так | Ні | Інша нода |
| Provider error (500) | Так | Так (1x), потім інша | Transient |
| Parse error | Так | Так | Claude may fix |
| Budget exceeded | **НІ** | — | Terminal; policy violation |
| Invalid prompt | **НІ** | — | Terminal; fix prompt |
| Worker crash | Так | **НІ** | Lease expire → requeue |
| Network timeout | Так | Retry submission 3x | Worker retries heartbeat/complete |

### 2.3 Backoff Configuration

```typescript
interface RetryPolicy {
  max_attempts: number;       // 1-10, default: 3
  backoff: "linear" | "exponential"; // default: "exponential"
  base_delay_sec: number;    // default: 15
  max_delay_sec: number;     // default: 300 (5 min)
  jitter: boolean;           // default: true (±20%)
}
```

---

## 3. Fallback Rules

### 3.1 Worker Fallback

```
Task dispatch failed on Worker A:
  │
  ├── Перевірити policy.allow_fallback (default: true)
  │
  ├── YES → pickWorker() з виключенням Worker A
  │   ├── Знайдений Worker B → dispatch на B
  │   └── Немає workers → task queued, чекає
  │
  └── NO → task failed (no fallback)
```

### 3.2 Provider Fallback (V1: тільки claude_cli)

V1 підтримує лише `claude_cli` як provider. Інші providers (claude_api, openai) — future work.

Специфікація для V2:
```json
{
  "policy": {
    "fallback_providers": ["claude_api", "openai"],
    "provider_preference": "claude_cli"
  }
}
```

---

## 4. Circuit Breaker

### 4.1 Per-Worker Circuit Breaker

```
                     ┌─────────┐
  success ──────────►│ CLOSED  │◄── initial state
                     └────┬────┘
                          │ 3 consecutive failures
                     ┌────▼────┐
                     │  OPEN   │── no tasks routed
                     └────┬────┘
                          │ cooldown elapsed (60s)
                     ┌────▼────┐
                     │HALF-OPEN│── allow 1 probe task
                     └────┬────┘
                       ┌──┴──┐
                       │     │
                  success  failure
                       │     │
                  ┌────▼┐ ┌──▼────┐
                  │CLOSE│ │ OPEN  │ (cooldown 120s)
                  └─────┘ └───────┘
```

### 4.2 Параметри

| Параметр | Значення | Опис |
|----------|----------|------|
| failure_threshold | 3 | Кількість помилок для відкриття circuit |
| cooldown_initial | 60с | Перший cooldown |
| cooldown_max | 300с | Максимальний cooldown |
| cooldown_multiplier | 2 | Подвоєння при повторних failures |
| probe_count | 1 | Задач у half-open |

---

## 5. Observability при Failures

### 5.1 Audit Log Events

| Подія | `action` | `detail` |
|-------|----------|----------|
| Task created | `task_created` | agent_slug, context_id |
| Task leased | `task_leased` | worker_id, TTL |
| Task dispatched | `task_dispatched` | worker_id |
| Dispatch failed | `dispatch_failed` | error message |
| Task completed | `task_completed` | status, duration_ms |
| Task requeued | `task_requeued` | reason |
| Lease expired | `lease_expired` | worker_id, was task_id |
| Worker registered | `worker_registered` | capabilities |
| Worker offline | `worker_offline` | last_heartbeat |
| Circuit opened | `circuit_opened` | worker_id, failures |

### 5.2 Frontend Error States

Узгоджено з `LOVABLE_INITIAL_INSTRUCTION §8` та `ІНТЕГРАЦІЯ_FRONTEND_LOVABLE §6.3`:

| Стан | UI відображення | Polling |
|------|-----------------|---------|
| Task queued, no workers | "Очікує доступного worker" | 5с |
| Task failed, retrying | "Повтор через Xс..." | 2с |
| Task dead | "Потребує ручного втручання" + кнопка "Requeue" | 30с |
| Worker offline | Badge "offline" + timestamp | 15с |
| Membridge unreachable | Banner "Control Plane недоступний" | 30с |
| Budget exceeded | "Бюджет вичерпано" (terminal, no retry) | — |
| 401/403 | Redirect до login | — |
| 429 | Toast: "Забагато запитів" | — |
| 503 | Toast: "Сервіс тимчасово недоступний" | — |

---

## 6. Recovery Playbook

### 6.1 "Всі задачі Dead"

1. `GET /api/runtime/llm-tasks?status=dead` → знайти dead tasks
2. `GET /api/runtime/workers` → перевірити чи є online workers
3. Якщо workers offline → виправити ноди → `POST /workers/:id/agent-restart`
4. `POST /api/runtime/llm-tasks/:id/requeue` для кожної dead задачі

### 6.2 "Worker постійно fails"

1. `GET /api/runtime/workers/:id/agent-health` → перевірити agent
2. Якщо `claude_cli: false` → перевстановити Claude CLI на ноді
3. Якщо `reachable: false` → перевірити мережу, порт 8001
4. `POST /api/runtime/workers/:id/agent-restart` → перезапустити

### 6.3 "Lease постійно expire"

1. Перевірити heartbeat від ноди: `GET /api/runtime/workers/:id`
2. Якщо `last_heartbeat` давно → нода проблемна
3. Збільшити TTL: dispatch з `{ ttl_seconds: 600 }`
4. Або зменшити `policy.timeout_sec` для задач

### 6.4 "Primary node offline (Membridge sync)"

З `ІНТЕГРАЦІЯ_MEMBRIDGE §8`:
1. Leadership lease expired → `needs_ui_selection: true`
2. Operator: `POST /api/membridge/projects/:cid/leadership/select` → вибрати нового Primary
3. Promote Secondary → Primary, потім push

---

## Semantic Relations

**Узгоджено з:**
- [[BLOOM_RUNTIME_MEMBRIDGE_CLAUDE_PROTOCOL_V1]] — протокол, state machine
- [[BLOOM_RUNTIME_NODE_CAPABILITIES_V1]] — worker capabilities, health
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI]] — error handling (§6.3)
- [[ІНТЕГРАЦІЯ_MEMBRIDGE]] — failure scenarios (§8)
- [[JOB_QUEUE_ТА_ARTIFACT_MODEL]] — invariants F1-F4

**На цей документ посилаються:**
- [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] — failure handling checklist
