# 📋 Технічне завдання (SRS) — AI Agent System для Digital Garden

**Версія**: 1.0  
**Дата**: 2026-01-16  
**Статус**: Draft for Review

---

## 1. Функціональні вимоги

### 1.1 Управління задачами агентів (FR-TASK)

| ID | Вимога | Пріоритет |
|----|--------|-----------|
| FR-TASK-01 | Власник може створювати задачі для агентів через UI | Must Have |
| FR-TASK-02 | Задача містить: роль, дію, вхідні дані, параметри | Must Have |
| FR-TASK-03 | Статуси задач: pending → processing → completed/failed | Must Have |
| FR-TASK-04 | RPi Agent отримує задачі через polling (10-30s інтервал) | Must Have |
| FR-TASK-05 | Опціонально: Webhook notification при новій задачі | Should Have |
| FR-TASK-06 | Історія задач зберігається 30 днів | Should Have |
| FR-TASK-07 | Можливість скасувати pending задачу | Should Have |

### 1.2 Система пропозицій (FR-PROP)

| ID | Вимога | Пріоритет |
|----|--------|-----------|
| FR-PROP-01 | Агент може створювати пропозиції задач (proactive mode) | Must Have |
| FR-PROP-02 | Пропозиція містить: тип, опис, джерела, оцінку складності | Must Have |
| FR-PROP-03 | Власник може Approve/Reject/Edit пропозицію | Must Have |
| FR-PROP-04 | Approved пропозиція автоматично стає задачею | Must Have |
| FR-PROP-05 | UI показує кількість нових пропозицій (badge) | Should Have |
| FR-PROP-06 | Email/Webhook notification про нові пропозиції | Could Have |

### 1.3 Виконання ролей (FR-ROLE)

| ID | Вимога | Пріоритет |
|----|--------|-----------|
| FR-ROLE-01 | Система підтримує 3 основні ролі: Archivist, Tech Writer, Architect | Must Have |
| FR-ROLE-02 | Кожна роль має унікальний system prompt | Must Have |
| FR-ROLE-03 | Роль отримує релевантний контекст через vector search | Must Have |
| FR-ROLE-04 | Роль генерує структурований markdown output | Must Have |
| FR-ROLE-05 | Додаткові ролі (Editor, Researcher) можуть бути додані пізніше | Could Have |

### 1.4 Vector Search (FR-VEC)

| ID | Вимога | Пріоритет |
|----|--------|-----------|
| FR-VEC-01 | Локальний vector search на RPi (sqlite-vec) | Must Have |
| FR-VEC-02 | Семантичний пошук по нотатках Digital Garden | Must Have |
| FR-VEC-03 | Embedding через all-MiniLM-L6-v2 (384 dims) | Must Have |
| FR-VEC-04 | Підтримка до 50K нотаток | Should Have |
| FR-VEC-05 | Backup vector DB в Replit (LanceDB) | Should Have |
| FR-VEC-06 | Синхронізація між RPi та Replit | Should Have |

### 1.5 Інтеграція з Cloudflare Worker (FR-API)

| ID | Вимога | Пріоритет |
|----|--------|-----------|
| FR-API-01 | Нові endpoints для агентів (/agents/*) | Must Have |
| FR-API-02 | Авторизація через існуючий owner JWT | Must Have |
| FR-API-03 | Rate limiting для polling requests | Should Have |
| FR-API-04 | Збереження результатів в MinIO + KV | Must Have |
| FR-API-05 | Результат агента відображається як AI comment | Must Have |

### 1.6 Prompt Caching (FR-CACHE)

| ID | Вимога | Пріоритет |
|----|--------|-----------|
| FR-CACHE-01 | System prompts кешуються через Claude API | Must Have |
| FR-CACHE-02 | Garden context кешується (5-min TTL, auto-refresh) | Must Have |
| FR-CACHE-03 | Моніторинг cache hit rate | Should Have |
| FR-CACHE-04 | Fallback на uncached mode при проблемах | Must Have |

---

## 2. Нефункціональні вимоги

### 2.1 Продуктивність (NFR-PERF)

| ID | Вимога | Метрика |
|----|--------|---------|
| NFR-PERF-01 | Polling latency | < 500ms p95 |
| NFR-PERF-02 | Vector search (10K docs) | < 100ms p95 |
| NFR-PERF-03 | Task creation | < 200ms p95 |
| NFR-PERF-04 | Agent execution (summary) | < 60s |
| NFR-PERF-05 | Agent execution (essay) | < 180s |

### 2.2 Надійність (NFR-REL)

| ID | Вимога | Метрика |
|----|--------|---------|
| NFR-REL-01 | Worker uptime | 99.9% |
| NFR-REL-02 | Task delivery guarantee | At-least-once |
| NFR-REL-03 | Data durability | No data loss |
| NFR-REL-04 | RPi offline tolerance | 24h queue retention |

### 2.3 Ресурси (NFR-RES)

| ID | Вимога | Ліміт |
|----|--------|-------|
| NFR-RES-01 | RPi RAM usage (idle) | < 300MB |
| NFR-RES-02 | RPi RAM usage (active) | < 700MB |
| NFR-RES-03 | sqlite-vec database size | < 500MB |
| NFR-RES-04 | Claude API cost/month | < $50 |
| NFR-RES-05 | Replit compute cost | Within Core tier |

### 2.4 Безпека (NFR-SEC)

| ID | Вимога | Опис |
|----|--------|------|
| NFR-SEC-01 | Agent API доступний тільки owner | JWT validation |
| NFR-SEC-02 | RPi ↔ Worker через HTTPS | TLS 1.3 |
| NFR-SEC-03 | Secrets зберігаються безпечно | env vars, not code |
| NFR-SEC-04 | Агент не має прямого доступу до production | Proposals only |

---

## 3. Обмеження системи

### 3.1 Hardware Constraints

```
┌────────────────────────────────────────────────────────────────┐
│                    RASPBERRY PI 3B LIMITS                       │
├────────────────────────────────────────────────────────────────┤
│  RAM:           1GB (available ~600-700MB after OS)            │
│  CPU:           ARM Cortex-A53, 4 cores @ 1.2GHz               │
│  Storage:       SD Card (slow random I/O)                       │
│  Network:       100Mbps Ethernet / WiFi b/g/n                   │
│                                                                 │
│  Implications:                                                  │
│  - No local LLM inference                                       │
│  - Vector DB must be disk-based (sqlite-vec, not HNSW)         │
│  - Embedding model must be < 100MB                              │
│  - Python process < 500MB                                       │
└────────────────────────────────────────────────────────────────┘
```

### 3.2 Claude CLI Constraints

```
┌────────────────────────────────────────────────────────────────┐
│                    CLAUDE CLI PRO LIMITS                        │
├────────────────────────────────────────────────────────────────┤
│  Context Window:  200K tokens (Claude 3.5 Sonnet)               │
│  Output Limit:    4096 tokens per response                      │
│  Rate Limit:      ~50 requests/hour (Pro tier)                  │
│  Caching TTL:     5 minutes (ephemeral)                         │
│                                                                 │
│  Implications:                                                  │
│  - Use RAG for large gardens (> 50K tokens)                    │
│  - Batch similar tasks for cache reuse                         │
│  - System prompts < 10K tokens                                 │
│  - Garden context chunks < 50K tokens                          │
└────────────────────────────────────────────────────────────────┘
```

### 3.3 Latency Constraints

```
┌────────────────────────────────────────────────────────────────┐
│                    NETWORK LATENCY BUDGET                       │
├────────────────────────────────────────────────────────────────┤
│  RPi → Worker (Cloudflare):     ~50-100ms                       │
│  RPi → Replit (Sync):           ~100-200ms                      │
│  RPi → Claude API:              ~500-2000ms (first token)       │
│  Worker → MinIO:                ~50-100ms                       │
│  Worker → KV:                   ~5-20ms                         │
│                                                                 │
│  Total Task Execution:                                          │
│  - Simple (summary):    5-15s                                   │
│  - Medium (essay):      30-60s                                  │
│  - Complex (analysis):  60-180s                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 4. Формати даних

### 4.1 Task Object

```typescript
interface AgentTask {
  id: string;                           // UUID
  role: 'archivist' | 'technical_writer' | 'architect';
  action: string;                       // 'summarize' | 'document' | 'analyze' | 'synthesize'
  
  input: {
    noteSlug?: string;                  // Single note reference
    noteIds?: string[];                 // Multiple notes
    content?: string;                   // Raw content input
    params?: {
      style?: 'academic' | 'casual' | 'technical';
      length?: 'short' | 'medium' | 'long';
      language?: 'uk' | 'en';
      [key: string]: any;
    };
  };
  
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  result?: {
    content: string;                    // Generated markdown
    metadata: {
      tokensUsed: number;
      cacheHit: boolean;
      processingTimeMs: number;
      sources: string[];                // Referenced notes
    };
  };
  
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  
  createdAt: string;                    // ISO 8601
  startedAt?: string;
  completedAt?: string;
  createdBy: string;                    // owner ID
}
```

### 4.2 Proposal Object

```typescript
interface AgentProposal {
  id: string;                           // UUID
  type: 'essay_suggestion' | 'doc_suggestion' | 'refactor_suggestion' | 'review_suggestion';
  
  role: 'archivist' | 'technical_writer' | 'architect';
  
  title: string;                        // Short description
  description: string;                  // Detailed explanation
  rationale: string;                    // Why agent suggests this
  
  sourceNotes: string[];                // Related note slugs
  estimatedEffort: {
    tokens: number;                     // Estimated LLM tokens
    timeMinutes: number;                // Estimated execution time
  };
  
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  
  approvalDetails?: {
    approvedBy: string;
    approvedAt: string;
    modifications?: string;             // Owner's edits to proposal
  };
  
  taskId?: string;                      // If approved, linked task ID
  
  createdAt: string;
  expiresAt: string;                    // Auto-expire after 7 days
}
```

### 4.3 Agent Output Metadata

```yaml
# YAML frontmatter for agent-generated content
---
title: "Синтез: Cloudflare Workers Best Practices"
author: ai-agent
agent_role: archivist
agent_version: "1.0"

source_notes:
  - "exodus.pp.ua/architecture/workers"
  - "exodus.pp.ua/security/serverless"
  - "exodus.pp.ua/performance/edge-caching"

generation_metadata:
  model: "claude-3.5-sonnet-20241022"
  tokens_used: 2847
  cache_hit: true
  processing_time_ms: 12340
  generated_at: "2026-01-16T14:30:00Z"

tags:
  - "#ai-generated"
  - "#synthesis"
  - "#cloudflare"

status: draft                           # draft | published
approval_status: pending                # pending | approved | rejected
---
```

---

## 5. API специфікація

### 5.1 Endpoints для агентів

```yaml
# Task Management
POST   /agents/tasks                    # Create new task
GET    /agents/tasks                    # List tasks (filterable)
GET    /agents/tasks/:taskId            # Get task details
PATCH  /agents/tasks/:taskId            # Update task (status, cancel)
DELETE /agents/tasks/:taskId            # Delete task (pending only)

# Task Results (RPi → Worker)
POST   /agents/results/:taskId          # Submit task result
GET    /agents/results/:taskId          # Get task result

# Proposals
GET    /agents/proposals                # List proposals
POST   /agents/proposals                # Create proposal (from RPi)
PATCH  /agents/proposals/:id            # Approve/Reject proposal
DELETE /agents/proposals/:id            # Delete proposal

# Agent Status (RPi polling)
GET    /agents/poll/:role               # Get pending tasks for role
POST   /agents/heartbeat                # Agent health check

# History & Analytics
GET    /agents/history                  # Completed tasks history
GET    /agents/stats                    # Usage statistics
```

### 5.2 Request/Response Examples

**Create Task**
```http
POST /agents/tasks
Authorization: Bearer <owner_jwt>
Content-Type: application/json

{
  "role": "archivist",
  "action": "summarize",
  "input": {
    "noteSlug": "exodus.pp.ua/architecture/workers",
    "params": {
      "style": "academic",
      "length": "medium",
      "language": "uk"
    }
  }
}
```

```http
HTTP/1.1 201 Created

{
  "success": true,
  "task": {
    "id": "task_abc123",
    "role": "archivist",
    "action": "summarize",
    "status": "pending",
    "createdAt": "2026-01-16T14:30:00Z"
  }
}
```

**Submit Result (from RPi)**
```http
POST /agents/results/task_abc123
Authorization: Bearer <agent_token>
Content-Type: application/json

{
  "content": "# Резюме: Cloudflare Workers Architecture\n\n...",
  "metadata": {
    "tokensUsed": 1523,
    "cacheHit": true,
    "processingTimeMs": 8420,
    "sources": ["exodus.pp.ua/architecture/workers"]
  }
}
```

---

## 6. Обробка помилок та Fallback сценарії

### 6.1 Error Codes

| Code | Name | Description | Retry |
|------|------|-------------|-------|
| `E_AUTH_FAILED` | Authentication Failed | Invalid or expired JWT | No |
| `E_TASK_NOT_FOUND` | Task Not Found | Task ID doesn't exist | No |
| `E_ROLE_UNKNOWN` | Unknown Role | Specified role not supported | No |
| `E_CLAUDE_TIMEOUT` | Claude API Timeout | API response timeout | Yes |
| `E_CLAUDE_RATE_LIMIT` | Claude Rate Limited | Too many requests | Yes (backoff) |
| `E_CONTEXT_TOO_LARGE` | Context Too Large | Notes exceed context window | No |
| `E_VECTOR_SEARCH_FAIL` | Vector Search Failed | sqlite-vec error | Yes |
| `E_NETWORK_ERROR` | Network Error | Connection failed | Yes |
| `E_STORAGE_ERROR` | Storage Error | MinIO/KV write failed | Yes |

### 6.2 Fallback Scenarios

**Scenario: Claude API Unavailable**
```
1. RPi detects Claude API error
2. Task status → "failed" with retryable=true
3. Task added to retry queue (max 3 retries)
4. Exponential backoff: 1min → 5min → 15min
5. After 3 failures → notify owner via proposal
```

**Scenario: RPi Offline**
```
1. Worker receives task creation
2. Task stored in KV with pending status
3. RPi reconnects → polls for pending tasks
4. Tasks with age > 24h → marked as expired
5. Expired tasks visible in UI for manual retry
```

**Scenario: Vector DB Corruption**
```
1. sqlite-vec query fails
2. Agent switches to "no-context" mode
3. Uses only provided input (no related notes)
4. Logs warning in result metadata
5. Background job: rebuild index from Replit backup
```

**Scenario: Context Window Exceeded**
```
1. Garden context > 150K tokens
2. Agent applies chunking strategy:
   a. Top-K most relevant (vector search)
   b. Summarize older content
   c. Truncate with "..." markers
3. Proceed with reduced context
4. Note limitation in result metadata
```

---

## Наступний документ

→ [02-agent-roles.md](./02-agent-roles.md) — Детальне проєктування ролей AI-агента
