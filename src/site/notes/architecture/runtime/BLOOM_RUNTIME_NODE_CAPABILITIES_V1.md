---
tags:
  - domain:runtime
  - status:canonical
  - format:spec
  - feature:node-capabilities
created: 2026-02-26
updated: 2026-02-26
tier: 1
title: "BLOOM Runtime: Можливості вузла V1"
dg-publish: true
---

# BLOOM Runtime: Node Capabilities V1

> Created: 2026-02-26
> Updated: 2026-02-26
> Author: architect
> Status: canonical
> Узгоджено з: LOVABLE_INITIAL_INSTRUCTION §4.3, INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §8, shared/schema.ts

---

## 1. Node Registration

### 1.1 Canonical WorkerNode (з shared/schema.ts + LOVABLE_INITIAL_INSTRUCTION §5.1)

```typescript
interface WorkerNode {
  // === Identity ===
  id: string;                     // UUID, генерується Runtime
  node_id: string;                // Унікальний ID ноди (hostname: "alpine", "rpi3b", "orangepi")
  url: string;                    // HTTP endpoint (http://192.168.3.184:8001)
  
  // === Status ===
  status: "online" | "offline" | "syncing" | "error" | "unknown";
  last_heartbeat: number | null;  // Unix timestamp останнього heartbeat
  ip_addrs: string[];             // ["192.168.3.184"]
  active_leases: number;          // Кількість активних leases
  
  // === Capabilities (з shared/schema.ts) ===
  capabilities: {
    claude_cli: boolean;          // Чи є claude CLI
    max_concurrency: number;      // Максимум одночасних задач (1-10)
    labels: string[];             // ["primary", "arm64", "eu-west", "free-tier"]
  };
  
  // === Platform (з LOVABLE_INITIAL_INSTRUCTION §4.3) ===
  agent_version: string;          // "0.4.0"
  os_info: string;                // "Alpine Linux 3.19 (aarch64)" або hostname
  install_method: string;         // "script" | "manual" | "unknown"
}
```

### 1.2 V1 Extended Registration (опціональні поля)

При реєстрації worker може відправити розширену декларацію:

```typescript
interface NodeRegistrationV1 extends WorkerNode {
  // === LLM Providers (V1 extension) ===
  capabilities: WorkerNode["capabilities"] & {
    llm_providers?: Array<{
      name: string;               // "claude_cli" | "claude_api" | "openai" | "local"
      available: boolean;
      models?: string[];          // ["claude-3.5-sonnet", "claude-3-haiku"]
      rate_limit?: {
        requests_per_minute?: number;
        tokens_per_minute?: number;
      };
    }>;
    
    features?: {
      artifacts: boolean;         // Чи може зберігати artifact у MinIO
      tools: string[];            // Доступні tools: ["web_search", "code_exec"]
      streaming: boolean;         // Чи підтримує streaming output
      context_window: number;     // Max context tokens (e.g., 200000)
    };
  };

  // === Extended Platform ===
  platform?: string;              // "linux"
  arch?: string;                  // "arm64" | "x86_64" | "armv7l"
}
```

### 1.3 Backward Compatibility

Поточний `server/routes.ts` підтримує спрощену реєстрацію:

```json
{
  "name": "alpine",
  "url": "http://192.168.3.184:8001",
  "capabilities": {
    "claude_cli": true,
    "max_concurrency": 2,
    "labels": ["primary"]
  }
}
```

V1 розширює, але не ламає — нові поля опціональні. Runtime заповнює defaults:
- `llm_providers`: `[{ name: "claude_cli", available: capabilities.claude_cli }]`
- `features`: `{ artifacts: false, tools: [], streaming: false, context_window: 200000 }`
- `platform`/`arch`: з `os_info` або "unknown"
- `install_method`: "unknown" якщо не вказано

### 1.4 Ваші ноди (приклади реєстрації)

**Alpine x86 (основний сервер):**
```json
{
  "name": "alpine",
  "url": "http://192.168.3.184:8001",
  "capabilities": {
    "claude_cli": true,
    "max_concurrency": 3,
    "labels": ["primary", "x86_64"]
  }
}
```

**Raspberry Pi 3B:**
```json
{
  "name": "rpi3b",
  "url": "http://192.168.3.XXX:8001",
  "capabilities": {
    "claude_cli": true,
    "max_concurrency": 1,
    "labels": ["arm64", "edge"]
  }
}
```

**Orange Pi PC2:**
```json
{
  "name": "orangepi",
  "url": "http://192.168.3.XXX:8001",
  "capabilities": {
    "claude_cli": true,
    "max_concurrency": 1,
    "labels": ["arm64", "edge"]
  }
}
```

---

## 2. Health Response (від Node)

Узгоджено з `agent/main.py /health` endpoint:

```typescript
interface NodeHealthResponse {
  status: "ok" | "degraded" | "error";
  version: string;                // Agent version ("0.4.0")
  hostname: string;
  uptime_seconds: number;
  
  // === LLM readiness ===
  claude_cli_available: boolean;
  claude_cli_version?: string;
  
  // === Resources ===
  system: {
    cpu_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    disk_free_gb: number;
  };
  
  // === Capabilities (canonical) ===
  capabilities: WorkerNode["capabilities"];
  
  // === Current load ===
  active_tasks: number;
  ip_addrs: string[];
}
```

---

## 3. Load Balancing Policy

### 3.1 Worker Selection Algorithm (pickWorker)

Узгоджено з `INTEGRATION_MEMBRIDGE_CLAUDE_CLI_PROXY §8.1`:

```
Input: task, workers[], activeLeases[]

1. FILTER — capability match:
   ├── worker.status === "online"
   ├── worker.capabilities.claude_cli === true
   └── worker.active_leases < worker.capabilities.max_concurrency

2. STICKY ROUTING — context affinity:
   ├── Знайти lease з тим самим context_id
   └── Якщо worker ще online та free → повернути його
       (зменшує overhead перезавантаження контексту)

3. SORT — weighted choice:
   ├── Primary: free_slots DESC (max_concurrency - active_leases)
   ├── Secondary: last_heartbeat DESC (найсвіжіший heartbeat)
   └── Tertiary: labels match (якщо task має label preference)

4. SELECT top candidate

5. If no candidates → return null (task залишається queued)
```

### 3.2 Label-based routing (V1 extension)

Задача може мати `preferred_labels`:

```json
{
  "policy": {
    "preferred_labels": ["x86_64"],
    "required_labels": ["primary"]
  }
}
```

- `required_labels`: worker ПОВИНЕН мати всі → фільтр
- `preferred_labels`: worker з більшістю preferred → вищий пріоритет (не фільтр)

### 3.3 Backpressure

| Ситуація | HTTP код | Поведінка |
|----------|----------|-----------|
| Всі workers зайняті | 503 | Task залишається queued; retry при наступному dispatch |
| Worker повертає 429 | — | Runtime позначає worker "busy"; retry на іншому |
| Worker timeout > 3x | — | Circuit breaker: 60с cooldown для worker |

### 3.4 Circuit Breaker

Деталі у [[BLOOM_RUNTIME_FAILURE_MODEL_V1]].

---

## 4. Worker Lifecycle

```
                    ┌──────────────────┐
  POST /workers     │   REGISTERED     │
                    │  (status: online)│
                    └────────┬─────────┘
                             │
                    heartbeat кожні 10с
                             │
                    ┌────────▼─────────┐
                    │     ONLINE       │◄── heartbeat OK
                    │  (ready for      │
                    │   task routing)  │
                    └────────┬─────────┘
                             │
                    no heartbeat > 60с
                             │
                    ┌────────▼─────────┐
                    │    OFFLINE       │
                    │  (no routing)    │
                    └────────┬─────────┘
                             │
                    heartbeat resumes
                             │
                    ┌────────▼─────────┐
                    │     ONLINE       │
                    └──────────────────┘
```

Membridge control plane оновлює worker status через workerSync (з `server/runtime/workerSync.ts`):
1. `GET /api/membridge/health` → якщо Membridge UP
2. `GET /agents` від Membridge CP → список агентів з heartbeats
3. Порівнює з локальною базою → upsert workers

---

## 5. Agent Operations (Fleet Management)

З `LOVABLE_INITIAL_INSTRUCTION §4.3`:

| Операція | Endpoint | Що робить |
|----------|----------|-----------|
| Health Check | `GET /workers/:id/agent-health` | HTTP GET до agent:8001/health |
| Update | `POST /workers/:id/agent-update` | `git pull` + restart на ноді |
| Restart | `POST /workers/:id/agent-restart` | Перезапуск systemd/OpenRC сервісу |
| Uninstall | `POST /workers/:id/agent-uninstall` | Видалення агента |
| Install Script | `GET /agent-install-script` | Генерація curl one-liner для нової ноди |

---

## Semantic Relations

**Узгоджено з:**
- [[LOVABLE_INITIAL_INSTRUCTION_BLOOM_AGENTS]] — WorkerNode interface, NodeManagement UI
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI]] — Worker selection algorithm
- [[ІНТЕГРАЦІЯ_MEMBRIDGE]] — Membridge Control Plane heartbeat protocol

**На цей документ посилаються:**
- [[BLOOM_RUNTIME_FAILURE_MODEL_V1]] — fallback при node offline
- [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] — node-agent checklist
