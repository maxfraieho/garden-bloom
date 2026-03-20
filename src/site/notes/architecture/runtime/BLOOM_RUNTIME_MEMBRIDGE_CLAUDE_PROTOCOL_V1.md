---
tags:
  - domain:runtime
  - status:canonical
  - format:spec
  - feature:protocol
created: 2026-02-26
updated: 2026-02-26
tier: 1
title: "BLOOM Runtime ↔ Membridge ↔ Claude: Protocol V1"
dg-publish: true
---

# BLOOM Runtime ↔ Membridge ↔ Claude: Protocol V1

> Created: 2026-02-26
> Updated: 2026-02-26
> Author: architect
> Status: canonical
> Мова: Українська (canonical)
> Узгоджено з: INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY, ІНТЕГРАЦІЯ_MEMBRIDGE, LOVABLE_INITIAL_INSTRUCTION, JOB_QUEUE_ТА_ARTIFACT_MODEL

---

## 0. Призначення

Визначає канонічний протокол взаємодії між трьома рівнями:

1. **BLOOM Runtime** (Express, порт 5000) — оркестратор задач, PostgreSQL persistence
2. **Membridge Node** (FastAPI agent, порт 8001) — worker з Claude CLI
3. **Claude CLI** — LLM-провайдер на кожній ноді

**Ключовий принцип:** Runtime делегує, ноди виконують, Claude відповідає. Ніхто не пише в canonical storage напряму.

**Аксіома (з INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY):** Workers never write directly to canonical storage. All mutations flow through the BLOOM Runtime after explicit consent.

---

## 1. Deployment Topology

```
                    ┌──────────────────────────────┐
                    │     Lovable Frontend (SPA)   │
                    │     projection-only layer    │
                    │     (Axiom A6: read + inbox) │
                    └─────────────┬────────────────┘
                                  │ HTTPS
                                  ▼
                    ┌──────────────────────────────┐
                    │   BLOOM Runtime (Express)    │
                    │   порт :5000 (Replit)        │
                    │                              │
                    │  ┌────────────────────────┐  │
                    │  │ Task Queue (PostgreSQL) │  │
                    │  │ Lease Manager           │  │
                    │  │ Artifact Store          │  │
                    │  │ Worker Router           │  │
                    │  │ Membridge Proxy         │  │
                    │  │ Multi-Project Git Mgmt  │  │
                    │  └────────────────────────┘  │
                    └────────┬─────────┬───────────┘
                             │         │
            X-MEMBRIDGE-ADMIN│         │ X-MEMBRIDGE-AGENT
                             ▼         ▼
                    ┌──────────────────────────────┐
                    │ Membridge Control Plane       │
                    │ порт :8000 (Alpine x86)       │
                    │ leadership, heartbeat, sync   │
                    └──────────────┬────────────────┘
                                   │ heartbeat (10s)
                    ┌──────────────┼──────────────┐
                    ▼              ▼              ▼
              ┌──────────┐  ┌──────────┐  ┌──────────┐
              │ Alpine   │  │ RPi 3B   │  │ OrangePi │
              │ x86 :8001│  │  :8001   │  │ PC2 :8001│
              │ Claude   │  │ Claude   │  │ Claude   │
              │ CLI      │  │ CLI      │  │ CLI      │
              └────┬─────┘  └────┬─────┘  └────┬─────┘
                   │              │              │
                   └──────────────┼──────────────┘
                                  ▼
                         ┌────────────────┐
                         │  MinIO (:9000) │
                         │ artifacts +    │
                         │ claude-mem.db  │
                         └────────────────┘
```

**Ваші реальні ноди:**
- Alpine x86 — основний сервер (Membridge CP :8000 + Agent :8001)
- Raspberry Pi 3B — edge node (Agent :8001)
- Orange Pi PC2 — edge node (Agent :8001)

---

## 2. Task Execution Envelope (канонічний DTO)

### 2.1 Створення задачі (Runtime → PostgreSQL)

Узгоджено з `shared/schema.ts` та `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY`:

```typescript
interface TaskEnvelope {
  // === Identity ===
  id: string;                     // UUID v4, генерується Runtime
  idempotency_key?: string;       // Опціональний; дозволяє dedupe при retry
  
  // === Agent ===
  agent_slug: string;             // Ідентифікатор агента ("writer", "architect")
  agent_kind?: string;            // Тип: "research" | "brief" | "proposal" | "custom"
  
  // === Input ===
  prompt: string;                 // Текстовий промпт для Claude
  structured_input?: Record<string, unknown>; // Опціональний JSON-вхід
  context_id: string;             // canonical_id проєкту (для sticky routing)
  context_hints: string[];        // Файли/шляхи для контексту (див. §7 Context Loading)
  
  // === Policy ===
  policy: {
    timeout_sec: number;          // 1-3600, default: 120
    retry: {
      max_attempts: number;       // 1-10, default: 3
      backoff: "linear" | "exponential"; // default: "exponential"
      base_delay_sec: number;     // default: 15
    };
    budget: {
      max_tokens: number;         // 0 = unlimited
      cost_tier?: "free" | "standard" | "premium"; // для routing
    };
  };
  
  // === Output ===
  desired_format: "json" | "text" | "markdown"; // V1 розширення: markdown додано
  
  // === Tracing (V1 extension) ===
  tracing?: {
    trace_id: string;             // OpenTelemetry-сумісний
    parent_span_id?: string;
    metadata?: Record<string, string>;
  };
  
  // === Attachments (V1 extension) ===
  attachments?: Array<{
    type: "presigned_url" | "inline";
    mime_type: string;
    url?: string;                 // MinIO presigned URL (для великих файлів)
    content?: string;             // Base64 або текст (для малих, < 10KB)
    filename?: string;
  }>;
  
  // === State (керується Runtime, узгоджено з shared/schema.ts) ===
  status: TaskStatus;
  created_at: number;
  updated_at: number;
  lease_id: string | null;
  worker_id: string | null;
  attempts: number;
  max_attempts: number;           // default: 3 (з policy.retry)
}

type TaskStatus = "queued" | "leased" | "running" | "completed" | "failed" | "dead";
```

**Backward compatibility:** Поточний `server/routes.ts` підтримує спрощене створення:
```json
{
  "context_id": "garden-seedling",
  "agent_slug": "writer",
  "prompt": "...",
  "desired_format": "text"
}
```
Нові поля (`tracing`, `attachments`, `idempotency_key`, `structured_input`) опціональні.

### 2.2 Dispatch Envelope (Runtime → Node)

Відправляється на ноду через `POST /execute-task`:

```typescript
interface DispatchEnvelope {
  task_id: string;
  prompt: string;
  context_id: string;
  agent_slug: string;
  agent_kind?: string;
  desired_format: "json" | "text" | "markdown";
  context_hints: string[];
  structured_input?: Record<string, unknown>;
  policy: {
    timeout_sec: number;
    budget: { max_tokens: number };
  };
  tracing?: {
    trace_id: string;
    parent_span_id?: string;
  };
  attachments?: Array<{ type: string; url?: string; content?: string }>;
  runtime_url: string;            // URL для heartbeat та completion callbacks
}
```

### 2.3 Result Envelope (Node → Runtime)

Узгоджено з `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §3`:

```typescript
interface ResultEnvelope {
  task_id: string;
  status: "success" | "error";
  output: string | null;            // LLM output (якщо success; MUST NOT be null)
  error_message: string | null;     // Помилка (якщо error; MUST NOT be null)
  artifact_type: string;            // "research_brief" | "brief" | "code" | "proposal"
  artifact_tags: string[];
  metrics: {
    duration_ms: number;            // MUST be non-negative
    tokens_used?: number;
    model?: string;                 // "claude-3.5-sonnet" тощо
    provider: string;               // "claude_cli"
  };
  partial_output?: string;          // Якщо timeout — часткова відповідь
}
```

**Validation rules (з INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §3.1):**
1. `task_id` must reference existing task in `running` or `leased` status
2. `worker_id` must match the worker assigned via active lease
3. `metrics.duration_ms` must be non-negative
4. If `status === "success"`, `output` MUST NOT be null
5. If `status === "error"`, `error_message` MUST NOT be null

---

## 3. Lease / Heartbeat / Completion State Machine

### 3.1 Повна стан-машина

Узгоджено з `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §2.2` та `JOB_QUEUE_ТА_ARTIFACT_MODEL §1`:

```
                         ┌──────────┐
        POST /llm-tasks  │  QUEUED  │
                         └────┬─────┘
                              │ pickWorker() → lease створено
                         ┌────▼─────┐
                    ┌────│  LEASED  │────┐
                    │    └────┬─────┘    │
                    │         │          │ expires_at < now
                    │    heartbeat      │ (без heartbeat)
                    │         │          │
                    │    ┌────▼─────┐    │
                    │    │ RUNNING  │    │
                    │    └────┬─────┘    │
                    │      ┌──┴──┐       │
                    │ ┌────▼┐  ┌▼─────┐  │
                    │ │DONE │  │FAILED│  │
                    │ └─────┘  └──┬───┘  │
                    │             │      │
                    │        attempts    │
                    │        < max?      │
                    │     YES │   NO     │
                    │  ┌───▼─┐   │      │
                    │  │QUEUE│   ▼      ▼
                    │  └─────┘ ┌──────────┐
                    └─────────►│   DEAD   │
                               └──────────┘
                                    │
                               manual requeue
                                    │
                               ┌────▼─────┐
                               │  QUEUED  │
                               └──────────┘
```

**Invariants (з JOB_QUEUE_ТА_ARTIFACT_MODEL):**
- **F1:** `COMPLETE → *` — перехід заборонений. COMPLETE є фінальним станом.
- **F2:** `DEAD → *` — автоматичний перехід відсутній; потребує ручного requeue.
- **F3:** Запис артефакту + статус COMPLETE виконуються в одній транзакції; часткові записи заборонені.

### 3.2 Lease lifecycle

Узгоджено з `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §4`:

| Крок | Ініціатор | Endpoint | Дія |
|------|-----------|----------|-----|
| 1. Create | Runtime (auto або manual) | `POST /llm-tasks/:id/lease` | Вибрати worker, створити lease, TTL = policy.timeout_sec + 30 |
| 2. Dispatch | Runtime | `POST worker:8001/execute-task` | Надіслати envelope на ноду |
| 3. Accept | Node | (internal) | Ноду починає виконувати Claude CLI |
| 4. Heartbeat | Node → Runtime | `POST /llm-tasks/:id/heartbeat` | Кожні 10с; оновлює last_heartbeat |
| 5a. Complete | Node → Runtime | `POST /llm-tasks/:id/complete` | Результат → artifact; lease released |
| 5b. Fail | Node → Runtime | `POST /llm-tasks/:id/complete` | status: "error"; lease failed |
| 6. Expire | Runtime (reaper, кожні 15с) | (internal) | Якщо now > expires_at → requeue або dead |

### 3.3 Lease Structure

```typescript
interface Lease {
  id: string;                   // UUID
  task_id: string;              // Bound task
  worker_id: string;            // Assigned worker
  started_at: number;           // Unix timestamp
  expires_at: number;           // started_at + ttl_seconds
  ttl_seconds: number;          // Default: policy.timeout_sec + 30
  status: LeaseStatus;          // active | expired | released | failed
  last_heartbeat: number;       // Last heartbeat Unix timestamp
  context_id: string | null;    // Для sticky routing
}

type LeaseStatus = "active" | "expired" | "released" | "failed";
```

### 3.4 TTL та інтервали

| Параметр | Значення | Джерело |
|----------|----------|---------|
| Lease TTL default | 300с (5 хв) | policy.timeout_sec + 30 |
| Heartbeat interval | 10с | Worker → Runtime |
| **Reaper interval** | **15с** | Runtime (узгоджено з INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §4.4) |
| Max attempts default | 3 | policy.retry.max_attempts |
| Backoff formula | `base_delay * 2^attempt` | exponential: 15→30→60с |

### 3.5 Exactly-once семантика

**Idempotency key:** Якщо `idempotency_key` вказаний при створенні задачі, Runtime перевіряє:
1. Чи є задача з таким ключем в статусі `completed` → повернути існуючу
2. Чи є задача в `queued`/`leased`/`running` → повернути 409 Conflict
3. Інакше → створити нову

**Artifact idempotency (з ІНТЕГРАЦІЯ_MEMBRIDGE §4):** POST з існуючим task_id та status=completed → повернути існуючий результат без дублювання.

### 3.6 Failover Flow (з INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §4.4)

```
1. Background reaper checks leases every 15 seconds
2. For each lease where now > expires_at:
   a. Set lease.status = "expired"
   b. If task.attempts < task.max_attempts:
      - Set task.status = "queued"
      - Clear task.lease_id and task.worker_id
      - Increment task.attempts
   c. Else:
      - Set task.status = "dead"
   d. Write audit log entry
```

---

## 4. Потік виконання Claude CLI на ноді

Узгоджено з `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §6`:

```
Node отримує POST /execute-task
        │
        ▼
  Validate envelope (agent_slug, prompt, context_hints)
        │
        ▼
  Prepare Claude CLI args:
  - --agent <agent_slug>
  - --prompt "<prompt>"
  - --context <context_hints>
  - --format <desired_format>
  - --timeout <policy.timeout_sec>
        │
        ├──► Start heartbeat thread (кожні 10с)
        │    POST runtime_url/api/runtime/llm-tasks/:id/heartbeat
        │
        ▼
  Execute Claude CLI subprocess
        │
  ┌─────┴──────┐
  │            │
  ▼            ▼
 OK          Error/Timeout
  │            │
  ▼            ▼
Parse output  Capture error_message
  │            │ (або partial_output якщо timeout)
  ▼            ▼
  POST runtime_url/api/runtime/llm-tasks/:id/complete
  {
    status: "success" | "error",
    output: "<result>",
    metrics: { duration_ms, tokens_used, model, provider: "claude_cli" }
  }
        │
        ▼
  Stop heartbeat thread
```

**Timeout handling (з INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §6.2):**
- Worker sets local alarm at `policy.timeout_sec`
- If Claude CLI exceeds timeout → worker kills the process
- Worker submits error result with `error_message: "timeout exceeded"`
- Якщо є partial output → зберігає у `partial_output`

---

## 5. Context Loading Rules (з INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §7)

### 5.1 Context Hints Format

| Hint Format | Example | Resolution |
|------------|---------|------------|
| Relative path | `src/agents/writer.md` | Resolve relative to project root |
| Glob pattern | `docs/*.md` | Expand to matching files |
| Agent reference | `@agent/writer` | Load agent definition from registry |
| Memory reference | `@memory/recent` | Load recent DiffMem entries (read-only) |

### 5.2 Context Size Limits

- Maximum total context: determined by `policy.budget.max_tokens`
- If context exceeds budget → worker truncates oldest entries first
- Context loading failures are **non-fatal**: worker proceeds with available context

### 5.3 Context Isolation Rules

1. Workers load context from their local filesystem (synced via Membridge)
2. Workers NEVER access other workers' local state
3. Workers NEVER write to shared context during execution
4. All context mutations happen post-execution through the Proposal system

---

## 6. API Endpoints (повний список V1)

### 6.1 Runtime API (порт 5000)

Узгоджено з `LOVABLE_INITIAL_INSTRUCTION §1.2` та `server/routes.ts`:

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/api/runtime/health` | Health check |
| GET | `/api/runtime/config` | Отримати конфіг |
| POST | `/api/runtime/config` | Зберегти конфіг |
| POST | `/api/runtime/test-connection` | Тест з'єднання з Membridge |
| GET | `/api/runtime/workers` | Список workers |
| GET | `/api/runtime/workers/:id` | Деталі worker + leases |
| POST | `/api/runtime/workers` | Реєстрація worker |
| DELETE | `/api/runtime/workers/:id` | Видалити worker |
| GET | `/api/runtime/workers/:id/agent-health` | Agent health check |
| POST | `/api/runtime/workers/:id/agent-update` | Оновити agent (git pull + restart) |
| POST | `/api/runtime/workers/:id/agent-restart` | Перезапуск agent |
| POST | `/api/runtime/workers/:id/agent-uninstall` | Видалення агента з ноди |
| GET | `/api/runtime/agent-install-script` | Генерація bash install script |
| POST | `/api/runtime/llm-tasks` | Створити задачу |
| GET | `/api/runtime/llm-tasks` | Список задач (?status=) |
| GET | `/api/runtime/llm-tasks/:id` | Деталі задачі |
| POST | `/api/runtime/llm-tasks/:id/lease` | Призначити worker |
| POST | `/api/runtime/llm-tasks/:id/dispatch` | Dispatch + execute |
| POST | `/api/runtime/llm-tasks/:id/heartbeat` | Heartbeat |
| POST | `/api/runtime/llm-tasks/:id/complete` | Завершити задачу |
| POST | `/api/runtime/llm-tasks/:id/requeue` | Перезапустити |
| GET | `/api/runtime/leases` | Список leases (?status=) |
| GET | `/api/runtime/runs` | Останні виконання |
| GET | `/api/runtime/artifacts` | Артефакти (?task_id=) |
| GET | `/api/runtime/audit` | Audit log (?limit=) |
| GET | `/api/runtime/stats` | Статистика |

### 6.2 Multi-Project Git Management (порт 5000)

З `LOVABLE_INITIAL_INSTRUCTION §1.2`:

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/api/runtime/projects` | Список managed git-проєктів |
| POST | `/api/runtime/projects` | Створити managed проєкт |
| GET | `/api/runtime/projects/:id` | Деталі проєкту + статус нод |
| DELETE | `/api/runtime/projects/:id` | Видалити проєкт |
| POST | `/api/runtime/projects/:id/clone` | Клонувати на конкретну ноду |
| POST | `/api/runtime/projects/:id/propagate` | Поширити на всі ноди |
| POST | `/api/runtime/projects/:id/sync-memory` | Push/pull claude-mem.db |
| GET | `/api/runtime/projects/:id/node-status` | Статус клонування по нодах |

### 6.3 Membridge Proxy (порт 5000, proxy до :8000)

| Метод | Шлях | Опис |
|-------|------|------|
| GET | `/api/membridge/health` | Proxy до Membridge health |
| GET | `/api/membridge/projects` | Список sync-проєктів |
| GET | `/api/membridge/projects/:cid/leadership` | Leadership lease |
| GET | `/api/membridge/projects/:cid/nodes` | Ноди проєкту |
| POST | `/api/membridge/projects/:cid/leadership/select` | Промотувати primary |

### 6.4 Node Agent API (порт 8001)

| Метод | Шлях | Auth | Опис |
|-------|------|------|------|
| GET | `/health` | — | Health + capabilities |
| GET | `/system-info` | — | Пам'ять, диск, uptime |
| GET | `/repos` | — | Список git repos |
| POST | `/execute-task` | X-MEMBRIDGE-AGENT | Виконати LLM-задачу |
| POST | `/self-update` | X-MEMBRIDGE-AGENT | Git pull + restart |
| POST | `/restart` | X-MEMBRIDGE-AGENT | Перезапуск сервісу |
| POST | `/uninstall` | X-MEMBRIDGE-AGENT | Деінсталяція |
| POST | `/clone` | X-MEMBRIDGE-AGENT | Клонування repo |
| POST | `/sync/push` | X-MEMBRIDGE-AGENT | Push claude-mem.db |
| POST | `/sync/pull` | X-MEMBRIDGE-AGENT | Pull claude-mem.db |

---

## 7. Приклади Request / Response

### 7.1 Створення задачі

```bash
curl -X POST http://runtime:5000/api/runtime/llm-tasks \
  -H "Content-Type: application/json" \
  -H "X-Runtime-API-Key: $RUNTIME_KEY" \
  -d '{
    "context_id": "garden-seedling",
    "agent_slug": "writer",
    "prompt": "Проаналізуй архітектуру проєкту та запропонуй покращення",
    "context_hints": ["docs/architecture/*.md"],
    "desired_format": "markdown",
    "max_attempts": 3
  }'
```

Response (201):
```json
{
  "id": "a1b2c3d4-...",
  "context_id": "garden-seedling",
  "agent_slug": "writer",
  "status": "queued",
  "created_at": 1740567600000,
  "attempts": 0,
  "max_attempts": 3
}
```

### 7.2 Dispatch

```bash
curl -X POST http://runtime:5000/api/runtime/llm-tasks/a1b2c3d4-.../dispatch
```

Response:
```json
{
  "dispatched": true,
  "task_id": "a1b2c3d4-...",
  "worker_id": "alpine",
  "lease_id": "lease-uuid-...",
  "execution": { "ok": true, "started": true }
}
```

### 7.3 Heartbeat (від ноди)

```bash
curl -X POST http://runtime:5000/api/runtime/llm-tasks/a1b2c3d4-.../heartbeat
```

### 7.4 Complete (від ноди)

```bash
curl -X POST http://runtime:5000/api/runtime/llm-tasks/a1b2c3d4-.../complete \
  -H "Content-Type: application/json" \
  -d '{
    "status": "success",
    "output": "## Архітектурний аналіз\n\n...",
    "artifact_type": "research_brief",
    "artifact_tags": ["architecture", "analysis"],
    "metrics": {
      "duration_ms": 45230,
      "tokens_used": 3200,
      "model": "claude-3.5-sonnet",
      "provider": "claude_cli"
    }
  }'
```

---

## 8. Security Model

### 8.1 Аутентифікація між компонентами

Узгоджено з `LOVABLE_INITIAL_INSTRUCTION §3.3` та `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §5.2`:

| Boundary | Mechanism | Header | Зберігання ключа |
|----------|-----------|--------|-------------------|
| Frontend → Runtime | Optional API key | `X-Runtime-API-Key` | Runtime env var (publishable, не секрет) |
| Runtime → Membridge CP | Admin key | `X-MEMBRIDGE-ADMIN` | Runtime env var, ніколи не у фронті |
| Runtime → Node | Agent key | `X-MEMBRIDGE-AGENT` | Runtime env var |
| Node → Runtime | API key | `X-Runtime-API-Key` | Node .env.agent |
| Node → Membridge CP | Admin key | `X-MEMBRIDGE-ADMIN` | Node .env.agent |
| Local → Agent | Exempt | — | localhost only |

### 8.2 Принцип найменших привілеїв

Узгоджено з `ІНТЕГРАЦІЯ_FRONTEND_LOVABLE §8` та `LOVABLE_INITIAL_INSTRUCTION §8`:

| Компонент | Дозволено | Заборонено |
|-----------|-----------|------------|
| Frontend | Read workers/tasks/leases/artifacts; Create tasks | Бачити ключі; доступ до MinIO/CP напряму |
| Runtime | CRUD workers/tasks/leases; proxy до CP; запис artifacts | Виконувати Claude CLI |
| Node | Виконувати Claude CLI; heartbeat; повертати results | Писати в canonical storage; CRUD інших задач |
| Membridge CP | Leadership; heartbeat registry; sync | Виконувати LLM; створювати tasks |

### 8.3 Два шари пам'яті (КРИТИЧНИЙ ІНВАРІАНТ)

З `LOVABLE_INITIAL_INSTRUCTION §2`:

| Шар | Сховище | Хто пише | Frontend показує |
|-----|---------|----------|-----------------|
| claude-mem.db | MinIO (через Membridge sync) | Claude CLI + hooks | Sync-статус через Membridge UI |
| DiffMem/git | git repository | Apply Engine via Proposals | Entities через MemoryPanel |

**Ці два шари НІКОЛИ не змішуються в UI.**

### 8.4 Audit Log

Кожна мутація генерує audit entry:

```json
{
  "id": "uuid",
  "timestamp": 1740567600000,
  "action": "task_created | task_leased | task_completed | worker_registered | ...",
  "entity_type": "llm_task | worker | lease | runtime_config",
  "entity_id": "uuid",
  "actor": "api | router | admin | worker_id",
  "detail": "Human-readable опис"
}
```

---

## 9. Rate Limiting

З `LOVABLE_INITIAL_INSTRUCTION §7`:

| Група | Ліміт | Endpoints |
|-------|-------|-----------|
| General | 100 req/хв | `/api/runtime/*`, `/api/membridge/*` |
| Strict | 20 req/хв | `POST /api/runtime/test-connection` |

Стандартні `RateLimit-*` заголовки. При перевищенні — HTTP 429.

---

## Semantic Relations

**Цей документ узгоджений з:**
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI]] — базова специфікація proxy pattern (канонічна)
- [[ІНТЕГРАЦІЯ_MEMBRIDGE]] — Membridge Control Plane contract
- [[JOB_QUEUE_ТА_ARTIFACT_MODEL]] — Job/Artifact state machines (invariants F1-F4)
- [[ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] — Frontend projection layer constraints (Axiom A6)
- [[LOVABLE_INITIAL_INSTRUCTION_BLOOM_AGENTS]] — Канонічна інструкція для Lovable (endpoints, types, constraints)

**На цей документ посилаються:**
- [[BLOOM_RUNTIME_NODE_CAPABILITIES_V1]] — Node registration деталі
- [[BLOOM_RUNTIME_FAILURE_MODEL_V1]] — Failure та fallback правила
- [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] — Integration bundle для всіх компонентів
