---
{"tags":["domain:arch","status:canonical","format:spec","feature:execution"],"created":"2026-02-24","updated":"2026-02-24","tier":1,"title":"Membridge Execution Dispatch + Claude CLI Proxy Executor","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/architecture/runtime/INTEGRATION_MEMBRIDGE_EXECUTION_DISPATCH/","dgPassFrontmatter":true,"noteIcon":""}
---


# Membridge Execution Dispatch + Claude CLI Proxy Executor

> Створено: 2026-02-24
> Автор: Архітектор системи
> Статус: Canonical
> Layer: Runtime Architecture
> Authority: BLOOM Runtime
> Scope: Distributed execution dispatch via membridge (tasks + leasing + workers + capabilities) with Claude CLI as LLM executor
> Мова: Українська (канонічна)

---

## 1. Визначення

**Membridge Execution Dispatch** — розширення membridge, що перетворює його на диспетчер виконання (dispatcher) для BLOOM Runtime:

- приймає tasks на виконання behavioral flows
- видає tasks воркерам через leasing
- маршрутизує tasks за capabilities / labels / capacity
- збирає результати, артефакти, логи, метрики
- підтримує replay / audit через зв'язок з canonical storage та DiffMem

**Claude CLI Proxy Executor** — режим воркера membridge, який виконує LLM-кроки через локально авторизований Claude CLI (без роздачі API ключів в агентний код), під повним контролем BLOOM Runtime та Proposal lifecycle.

---

## 2. Ролі в системі (canonical)

### 2.1 Garden Bloom (Orchestrator / UI / Backend)

- Зберігає behavioral logic (DRAKON-графи, версії, експорт у псевдокод / IR)
- Компілює DRAKON → IR (на сервері) і підписує IR
- Створює tasks ("виконати flow X з inputs Y у context Z")
- Приймає результати: artifacts / logs / metrics + proposals
- Застосування змін — лише через Proposal lifecycle (owner sovereignty)

### 2.2 Membridge Server (Dispatcher / Broker / Balancer)

- Worker registry (capabilities, capacity, labels, health)
- Task queue + routing
- Leasing + heartbeat + requeue при збоях
- Run history + observability
- Збір artifacts / logs / metrics і передача у BLOOM Runtime

### 2.3 Membridge Worker (Executor Node)

- Daemon режим: pull tasks → execute → push results
- IR executor (deterministic state machine interpreter)
- LLM executor adapter (Claude CLI) для вузлів типу `llm_call`
- Tool adapters (http / minio / fs) тільки через allowlist policies
- **Немає прямого write в canonical storage**

---

## 3. IR як проміжне представлення

Для стабільного виконання потрібне **IR JSON v0.1**, яке визначає:

| Компонент | Опис |
|-----------|------|
| Node types | `action`, `llm_call`, `decision`, `emit`, `return` |
| Контракти | Типізовані `input` / `output` для кожного вузла |
| Policy | `allowed_tools` + sandbox profile |
| Integrity | `version` + `hash` + `signature` |

### Compilation Pipeline

```
DRAKON schema
  → export pseudocode
    → compile to IR JSON (signed)
      → Worker виконує deterministic interpreter
```

LLM використовується лише у вузлах типу `llm_call`. Решта вузлів — deterministic execution.

---

## 4. Task Envelope / Result Envelope (MVP контракт)

### 4.1 Task Envelope

```json
{
  "task_id":       "uuid-v4",
  "context_id":    "uuid-v4",
  "flow_id":       "flow-slug",
  "flow_version":  "1.0.0",
  "ir_ref":        "artifacts/ir/flow-slug-v1.0.0.signed.json",
  "inputs":        { "query": "...", "scope": "..." },
  "limits": {
    "timeout_seconds": 300,
    "max_tokens":      50000,
    "cost_policy":     "standard"
  },
  "policy": {
    "allowed_tools": ["memory-read", "notebooklm-query"],
    "sandbox":       "restricted"
  },
  "lease": {
    "issued_at":   "2026-02-24T10:00:00Z",
    "expires_at":  "2026-02-24T10:05:00Z",
    "worker_id":   "rpi4b"
  }
}
```

### 4.2 Result Envelope

```json
{
  "task_id":  "uuid-v4",
  "status":   "success | failed | timeout",
  "outputs":  { "summary": "...", "proposals": [] },
  "artifacts": [
    {
      "artifact_id":  "art-uuid",
      "type":         "EXECUTION_RESULT",
      "url":          "artifacts/results/art-uuid.json"
    }
  ],
  "logs": [
    { "ts": "...", "phase": "llm_call", "node_id": "n3", "ms": 2400 }
  ],
  "metrics": {
    "latency_ms":    4200,
    "tokens_used":   12000,
    "retries":       0
  }
}
```

---

## 5. Capabilities + Leasing + Failover

### 5.1 Worker Advertisement

```json
{
  "worker_id":     "rpi4b",
  "capabilities":  ["llm.claude_cli", "tool.memory_read", "tool.http"],
  "capacity":      { "max_concurrency": 2 },
  "labels":        ["rpi", "low_cost", "arm64"],
  "version":       "0.1.0"
}
```

### 5.2 Leasing Model

| Правило | Опис |
|---------|------|
| Single executor | Лише один воркер виконує Task одночасно |
| Heartbeat required | Воркер надсилає heartbeat кожні N секунд під час execution |
| Lease expiry | При відсутності heartbeat → task requeued |
| Retry tracking | Runs відстежуються для retries та audit |

### 5.3 Failover

```
Worker lease expires (no heartbeat)
  → Dispatcher: requeue task
    → Route to next available worker
      → New lease issued
```

Максимальна кількість спроб: 3. Після цього → task status `DEAD`, потребує manual requeue.

---

## 6. Claude CLI Proxy Executor

Claude CLI використовується як **локальний LLM executor**:

### 6.1 Принцип роботи

```
Worker отримує Task з IR
  → IR interpreter виконує deterministic nodes
    → На вузлі типу llm_call:
      → Worker формує prompt з node.input + memory-read references
      → Worker викликає claude CLI (локально авторизований)
      → claude CLI повертає structured output
      → Worker парсить output, передає далі по IR
```

### 6.2 Security Properties

| Властивість | Опис |
|-------------|------|
| No secrets in payload | Task envelope не містить API ключів; auth — node-local |
| Memory-read only | Контекст подається через DiffMem memory-read references |
| Structured output | Результат claude CLI парситься як JSON; raw text заборонений |
| Audit trail | Кожен `llm_call` логується: prompt hash, tokens, latency |

### 6.3 Claude CLI Invocation

```bash
# Worker внутрішньо виконує:
claude --print --output-format json \
  --system-prompt "<IR node system prompt>" \
  --append-system-prompt "<memory context>" \
  "<user prompt from IR node>"
```

Результат парситься як JSON. Якщо парсинг невдалий → retry з simplified prompt або → task `failed`.

---

## 7. Memory Integration (DiffMem) — Authority Boundaries

### 7.1 Worker (Executor)

| Операція | Дозвіл |
|----------|--------|
| Memory-read (DiffMem Layer 1/2) | ✅ Дозволено |
| Write artifacts | ✅ Через Result Envelope |
| Write proposals | ✅ Через Result Envelope |
| Direct write to canonical storage | ❌ Заборонено |
| Direct write to MinIO | ❌ Заборонено |

### 7.2 BLOOM Runtime (Orchestrator)

| Операція | Дозвіл |
|----------|--------|
| Write to canonical storage | ✅ Через Proposal lifecycle |
| Apply proposals | ✅ Після owner approval |
| Ingest artifacts | ✅ З Result Envelope |

### 7.3 DiffMem

- Persistence layer execution memory (versioned / replayable)
- Worker читає; Runtime пише
- Append-only для audit integrity

---

## 8. Безпека та Trust Boundaries

| Загроза | Захист |
|---------|--------|
| Виконання непідписаного IR | Worker виконує тільки signed flows; hash verification |
| Несанкціонований tool access | Allowlist policies у Task Envelope; без raw shell |
| Витік memory scope | Least privilege: worker бачить лише delegated scope |
| Replay attack | Task ID ідемпотентний; lease epoch prevents replay |
| Unauthorized canonical write | Workers не мають write-доступу до canonical storage |

### Trust Boundary Diagram

```
┌─────────────────────────────────────────────────┐
│  BLOOM Runtime (Trusted)                        │
│  ┌──────────┐  ┌───────────┐  ┌──────────────┐ │
│  │Orchestr. │  │ Proposal  │  │  Canonical   │ │
│  │ Layer    │  │ Lifecycle │  │  Storage     │ │
│  └────┬─────┘  └───────────┘  └──────────────┘ │
│       │                                         │
│       │ Task Envelope (signed IR)               │
│       ▼                                         │
│  ┌──────────────────────────────┐               │
│  │  Membridge Dispatcher       │               │
│  │  (routing, leasing, audit)  │               │
│  └────┬─────────────────┬──────┘               │
└───────┼─────────────────┼───────────────────────┘
        │                 │
        ▼                 ▼
   ┌─────────┐      ┌─────────┐
   │Worker A │      │Worker B │   ← Untrusted execution
   │(rpi4b)  │      │(orange) │
   │claude   │      │claude   │
   │CLI local│      │CLI local│
   └─────────┘      └─────────┘
        │                 │
        ▼                 ▼
   Result Envelope (artifacts + proposals)
        │
        ▼
   BLOOM Runtime: apply via Proposal lifecycle
```

---

## 9. Observability (Мінімум)

| Метрика | Джерело | Endpoint |
|---------|---------|----------|
| Workers online / offline | Heartbeat registry | `GET /workers` |
| Active leases | Lease table | `GET /leases/active` |
| Runs history | Run storage | `GET /runs` |
| Last execution summary | Run detail | `GET /runs/{id}` |
| Basic metrics | Result Envelopes | `GET /metrics` |

### Structured Log Entry

```json
{
  "ts":        "2026-02-24T10:02:30Z",
  "level":     "INFO",
  "task_id":   "uuid",
  "worker_id": "rpi4b",
  "phase":     "llm_call",
  "node_id":   "n3",
  "ms":        2400,
  "tokens":    1200
}
```

---

## 10. MVP Implementation Plan (Backend)

### Phase 1 — Worker Registry + Heartbeat

- [ ] Worker advertisement endpoint: `POST /workers/register`
- [ ] Heartbeat endpoint: `POST /workers/{id}/heartbeat`
- [ ] Worker status table (in-memory або KV)
- [ ] Stale worker detection (heartbeat timeout)

### Phase 2 — Tasks + Leasing

- [ ] Task table (MinIO або KV): create, list, get
- [ ] Leasing endpoints: `POST /tasks/{id}/lease`, `POST /tasks/{id}/release`
- [ ] Lease expiry + automatic requeue
- [ ] Task status transitions: `pending → leased → executing → completed | failed | dead`

### Phase 3 — Worker Daemon + IR Interpreter v0.1

- [ ] Worker daemon: poll `/tasks/available` → execute → push result
- [ ] IR interpreter: deterministic state machine для `action`, `decision`, `emit`, `return`
- [ ] Node execution loop з timeout per node

### Phase 4 — Claude CLI Adapter

- [ ] `llm_call` node handler: формує prompt, викликає claude CLI
- [ ] Structured output parsing (JSON mode)
- [ ] Token counting та cost tracking
- [ ] Retry logic для failed LLM calls

### Phase 5 — Artifacts + Audit

- [ ] Result Envelope ingestion endpoint
- [ ] Artifact storage в MinIO
- [ ] Audit log linking (task → artifacts → proposals)
- [ ] Run history with step-level detail

### Phase 6 — Runtime UI Status Panel

- [ ] Workers status view
- [ ] Active tasks / leases view
- [ ] Run history with drill-down
- [ ] Basic metrics dashboard

---

## 11. Узгодження з існуючою архітектурою

### 11.1 Leadership Model (Membridge)

Execution Dispatch **не порушує** single-source-of-truth model:

- Leadership lease залишається для sync (push/pull claude-mem.db)
- Task dispatch — паралельна функціональність, не конфліктує з leadership
- Worker може бути і Primary (для sync) і Executor (для tasks) одночасно

### 11.2 Proposal Lifecycle

Workers **не мають** write-доступу до canonical storage:

- Worker повертає proposals у Result Envelope
- BLOOM Runtime застосовує proposals через standard Proposal lifecycle
- Owner sovereignty зберігається

### 11.3 Authority Matrix

| Компонент | Tasks | Leases | Workers | Artifacts | Canonical Storage |
|-----------|:-----:|:------:|:-------:|:---------:|:-----------------:|
| Orchestrator | Create | — | — | Read | Write (via Proposal) |
| Dispatcher | Route | Write | Registry | Ingest | — |
| Worker | Execute | Heartbeat | Advertise | Create | ❌ |
| Owner | Approve | — | — | Read | Approve |

---

## 12. Семантичні зв'язки

**Цей документ залежить від:**
- [[EXECUTION_PROTOCOL]] — канонічний lifecycle виконання
- [[BLOOM_MEMORY_ARCHITECTURE]] — memory model та DiffMem
- [[BLOOM_RUNTIME_IDENTITY]] — execution identity
- [[КОНТРАКТ_АГЕНТА_V1]] — контракт агента

**Цей документ доповнює:**
- [[КОНТРАКТ_АГЕНТА_V1]] — Worker як реалізація Agent Contract
- [[АБСТРАКЦІЯ_РІВНЯ_ОРКЕСТРАЦІЇ]] — Dispatcher як компонент orchestration layer

**На цей документ посилаються:**
- [[ІНТЕГРАЦІЯ_MEMBRIDGE]] — membridge як інфраструктура dispatch
- [[ПЕРСПЕКТИВА_АГЕНТНОЇ_РОЗРОБКИ]] — Agent Proxies як наступний крок

---

*Цей документ визначає канонічну специфікацію execution dispatch через membridge з Claude CLI як LLM executor.*
