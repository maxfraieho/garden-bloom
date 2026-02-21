# Garden Bloom: Архітектурний корінь

> Створено: 2026-02-21
> Автор: Головний архітектор системи
> Статус: Канонічний корінь архітектури
> Мова: Українська (канонічна)

---

## 0. Призначення

Цей документ є **архітектурним коренем** Garden Bloom. Він не описує деталі реалізації. Він визначає, **з яких аксіом система побудована**, які ролі має кожен компонент і як із цих аксіом випливає canonical flow.

Всі інші архітектурні документи є деталізацією цього кореня.

---

## 1. Визначення системи

**Garden Bloom** — це execution platform для автономних AI-агентів із вбудованою моделлю людського контролю.

Система побудована на трьох фундаментальних ідеях:

- **Знання — не пасивні файли.** Markdown-файли та папки є одночасно визначеннями агентів, їхньою пам'яттю та поведінкою.
- **Автономія — не безконтрольність.** Агент пропонує зміни. Людина вирішує.
- **Сховище — єдина істина.** Runtime-компоненти виконують і координують. Але вони не є source of truth.

---

## 2. Архітектурні аксіоми

Аксіоми — це твердження, яким зобов'язані підпорядковуватися **всі** рішення. Якщо реалізація суперечить аксіомі — помилкова реалізація, не аксіома.

### A1 — Сховище є єдиною авторитетом

MinIO та git monorepo `garden-bloom-memory` є **єдиними canonical sources of truth**.

Жоден runtime-компонент (Hatchet, Mastra, Gateway) не є авторитетним. Якщо вони втрачають стан — система відновлюється зі сховища. Якщо сховище втрачає дані — система втрачає дані. Це асиметрія за задумом.

### A2 — Мутація вимагає згоди

**Жоден компонент не змінює canonical storage напряму.**

Будь-яка зміна знань, пам'яті або логіки агента відбувається виключно через lifecycle:

```
Proposal (pending) → Approval → Apply → Storage updated
```

Агент не пише. Агент пропонує.

### A3 — Виконання є stateless

Mastra є **stateless interpreter**. При кожному запуску він завантажує визначення агента (`_agent.md`) зі сховища та не зберігає між запусками нічого власного.

Стан між запусками живе в пам'яті агента (git monorepo), не в Mastra.

### A4 — Orchestration є замінним

Orchestration Layer (Hatchet) відповідає за **коли**, **в якому порядку** та **з якою надійністю** виконуються кроки. Він — vendor-agnostic абстракція.

Заміна Hatchet на Temporal, Restate або будь-який інший оркестратор не змінює архітектуру — лише реалізацію адаптера.

### A5 — Gateway є єдиною точкою входу

Cloudflare Worker є **єдиним авторизованим gateway** між зовнішнім світом та системою.

Frontend не звертається до Mastra, Hatchet або MinIO напряму. Все — через Worker.

### A6 — Frontend є проекцією

Frontend читає canonical state через Worker. Він не має write authority. Він лише відображає.

Будь-який стан, що відображається у Frontend, має своїм джерелом MinIO або git monorepo — не Frontend.

### A7 — Пам'ять агента є обмеженою

Пам'ять агента живе в `garden-bloom-memory` git monorepo з двошаровою моделлю та HARD limits:

- Шар 1 (auto-load): ≤ 12 000 токенів сукупно; завантажується при кожному запуску
- Шар 2 (explicit-only): завантажується лише за явним запитом агента

Перевищення HARD limit веде до автоматичного eviction. Безмежна пам'ять порушує A1.

---

## 3. Компоненти та їхні ролі

| Компонент | Роль | Авторитет |
|-----------|------|-----------|
| **MinIO** | Canonical storage: визначення агентів, runs, proposals, аудит | Source of truth |
| **git monorepo** (`garden-bloom-memory`) | Canonical storage: пам'ять агентів (Layer 1/2), логіка (logic/) | Source of truth |
| **Hatchet** (Orchestration Layer) | Durable execution, concurrency control, scheduling, status writer | Execution coordinator |
| **Mastra** (Runtime) | Stateless interpreter `_agent.md` + pseudocode; викликає tools; повертає proposals | Interpreter |
| **FastAPI** | Isolated cognitive proxy до NotebookLM (NLM) | Isolated tool endpoint |
| **Cloudflare Worker** (Gateway) | Auth, routing, write gatekeeper; початковий запис status "requested" | Entrypoint & gatekeeper |
| **Frontend** (Lovable) | Projection layer: відображає canonical state, ініціює дії Owner | Читач |
| **Optimizer agent** | Спеціалізований агент: аналізує runs, пропонує logic-update Proposals | Агент (не компонент) |

---

## 4. Authority Boundaries

### 4.1 Write authority

| Що | Хто пише | Умова |
|----|----------|-------|
| `status.json` → "requested" | Cloudflare Worker | Лише initial write |
| `status.json` → всі інші transitions | Hatchet wrapper | Після кожного step |
| `runs/{runId}/steps/*.json` | Hatchet wrapper | Step completion |
| `runs/{runId}/manifest.json` | Hatchet wrapper | Run finalize |
| `proposals/*.json` → pending | Hatchet wrapper | Run output |
| `proposals/*.json` → transitions | Worker | Owner action |
| `agents/{slug}/_agent.md`, sources | Worker | Owner command |
| `memory/{agentId}/*` | Gateway (Proposal lifecycle) | Auto або human approval |
| `logic/{agentId}/current.*` | Gateway (Proposal lifecycle) | Завжди human review |

**[ІНВАРІАНТ]** Mastra не пише нічого. FastAPI не пише нічого. Frontend не пише нічого.

### 4.2 Execute authority

| Дія | Хто виконує |
|-----|-------------|
| Запуск агентного run | Hatchet (via Adapter) |
| Виклик Mastra | Hatchet wrapper (всередині step) |
| Виклик NLM tool | Mastra → FastAPI |
| Apply proposal | Worker (Apply Engine) |
| Memory eviction | Gateway (cron) |

### 4.3 Read authority

| Хто | Що читає | Як |
|-----|----------|-----|
| Worker | Все (MinIO) | S3 API |
| Hatchet wrapper | `_agent.md`, sources (MinIO); memory Layer 1 (git monorepo) | S3 API + Gateway API |
| Mastra | Sources | Tool: `read-context` |
| Mastra | Memory Layer 1 | Tool: `read-memory()` |
| Frontend | Нічого напряму | Через Worker API |
| FastAPI | Нічого | — |

---

## 5. Canonical Flow

```
Owner / Cron
     │
     ▼
[Intent]
Дія або розклад ініціює run

     │
     ▼
[Inbox — Cloudflare Worker]
Validate JWT → Generate run_id → Write status "requested" → Trigger Hatchet → 202 Accepted

     │
     ▼
[Orchestration — Hatchet]
Enqueue → Concurrency check → Start durable execution

     │
     ▼
[Context Load — Hatchet wrapper]
Load _agent.md + sources (MinIO) → Load memory Layer 1 (git monorepo via Gateway)
Write step 1 result → Update status: running

     │
     ▼
[Runtime — Mastra]
Parse _agent.md → Register tools → Execute (LLM + tools: NLM, read-context, read-memory)
Return structured output {proposals[], memory_updates[]}
Write step 2 result → Update status: step 2

     │
     ▼
[Proposal — Hatchet wrapper]
Write content proposals → MinIO {status: pending}
POST memory-update → Gateway {auto или human approval}
POST logic-update (якщо optimizer) → Gateway {завжди human review}
Write step 3 result → Update status: step 3

     │
     ▼
[Finalize — Hatchet wrapper]
Write manifest.json → Update status: completed

     │
     ▼
[Apply — Cloudflare Worker]
Owner approves via Frontend → Worker applies:
  content proposal → MinIO write
  memory-update → git commit (garden-bloom-memory)
  logic-update → git commit (з human review)

     │
     ▼
[Storage — MinIO / git monorepo]
Canonical state updated. This is the truth.

     │
     ▼
[Projection — Frontend]
Poll Worker → Read status.json → Display state
```

---

## 6. Деталізація в інших документах

Цей документ є коренем. Деталі — в спеціалізованих specs:

| Аспект | Документ |
|--------|----------|
| Повна runtime архітектура | `RUNTIME_ARCHITECTURE_CANONICAL.md` |
| Orchestration Layer контракт | `ORCHESTRATION_LAYER_ABSTRACTION.md` |
| Storage authority (повна матриця) | `STORAGE_AUTHORITY_MODEL_CANONICAL.md` |
| Execution pipeline (7 фаз) | `EXECUTION_PIPELINE_CANONICAL.md` |
| Run lifecycle (state machine) | `RUN_LIFECYCLE_CANONICAL.md` |
| Agent memory model | `AGENT_MEMORY_GIT_DIFFMEM_V1.md` |
| Logic versioning | `AGENT_LOGIC_VERSIONING_V1.md` |
| Proposal system | `INBOX_ТА_PROPOSAL_АРХІТЕКТУРА.md` |
| Agent contract | `КОНТРАКТ_АГЕНТА_V1.md` |
| API contracts | `../backend/API_CONTRACTS_V1.md` |

---

## 7. Термінологічне уточнення

**[РІШЕННЯ]** Для уникнення плутанини між документами різних епох:

| Термін | Значення в цьому документі |
|--------|---------------------------|
| **Gateway** | Cloudflare Worker — єдина точка входу |
| **Orchestration Layer** | Hatchet (або будь-який vendor через Adapter) — coordination |
| **Runtime** | Mastra — stateless agent interpreter |
| **Cognitive proxy** | FastAPI — isolated NLM endpoint |

> **Зауваження щодо АРХІТЕКТУРНА_БАЗА_СИСТЕМИ.md**: цей документ (2026-02-14) використовує термін "Orchestration Layer" для Cloudflare Worker і описує Replit FastAPI як "Backend шар". Обидва терміни належать до попередньої архітектурної епохи. Актуальна термінологія — у цьому документі.

---

*Цей документ є архітектурним коренем Garden Bloom. Він визначає аксіоми, ролі та canonical flow. Деталізація — у спеціалізованих documents, перелічених у §6.*
