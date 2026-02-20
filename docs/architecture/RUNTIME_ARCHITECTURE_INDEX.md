# Runtime Architecture: Master Index

> Створено: 2026-02-15
> Автор: Головний архітектор системи
> Статус: Канонічний entry point
> Мова: Українська (канонічна)

---

## 0. Призначення

Цей файл є **canonical entry point** для runtime-архітектури Garden Seedling. Він пов'язує всі canonical документи, що описують систему у vendor-agnostic термінах.

**[ПРИНЦИП]** Архітектура описує ролі та контракти, не vendor-specific реалізації. Orchestration Layer — замінний компонент (vendor-agnostic; adapter-based). Рекомендовані оркестратори: **Hatchet** (MIT, FastAPI-native SDK, Hatchet Lite ~1-2 GB RAM) або **Restate** (single binary ~256 MB, для мінімальних ресурсів). Деталі абстракції та порівняльний аналіз — у ORCHESTRATION_LAYER_ABSTRACTION.md.

---

## 0.1 Project Entry Point

| Документ | Опис |
|---------|------|
| **[PROJECT_DESCRIPTION_CANONICAL.md](../PROJECT_DESCRIPTION_CANONICAL.md)** | Canonical, vendor-agnostic опис проєкту — overview, principles, layers, authority model |

> Рекомендовано читати першим для загального розуміння системи.

---

## 1. Canonical Runtime Documents

| # | Документ | Опис | Ключові розділи |
|---|---------|------|-----------------|
| 1 | **RUNTIME_ARCHITECTURE_CANONICAL.md** | Загальна canonical архітектура | Інваріанти, ролі компонентів, діаграми, deployment |
| 2 | **ORCHESTRATION_LAYER_ABSTRACTION.md** | Orchestration Layer як абстракція | Capabilities, Adapter Interface, Task Definition, vendor criteria |
| 3 | **RUN_LIFECYCLE_CANONICAL.md** | Run state machine та lifecycle | States, transitions, Status Writer, polling, failure handling |
| 4 | **EXECUTION_PIPELINE_CANONICAL.md** | Pipeline від trigger до completion | 7 фаз, data flow, ordering guarantees, error recovery |
| 5 | **STORAGE_AUTHORITY_MODEL_CANONICAL.md** | Storage authority model | Write/Read authority, anti-patterns, data lifecycle, recovery |
| 6 | **AGENT_MEMORY_GIT_DIFFMEM_V1.md** | Git-based агентна пам'ять (v1.1.0) | DiffMem монорепо, два шари пам'яті, HARD ліміти, витіснення |
| 7 | **AGENT_LOGIC_VERSIONING_V1.md** | Версіонування логіки агентів (v1.0.0) | logic/ структура, агент-оптимізатор, logic-update Proposals |

---

## 2. Reading Order

### Для нового reader:
1. **RUNTIME_ARCHITECTURE_CANONICAL.md** — загальна картина
2. **STORAGE_AUTHORITY_MODEL_CANONICAL.md** — хто що зберігає
3. **ORCHESTRATION_LAYER_ABSTRACTION.md** — як координується виконання
4. **RUN_LIFECYCLE_CANONICAL.md** — state machine
5. **EXECUTION_PIPELINE_CANONICAL.md** — деталі виконання

### Для frontend developer (Lovable):
1. **RUN_LIFECYCLE_CANONICAL.md** §1 (states), §4 (polling)
2. **INBOX_AND_RUN_LIFECYCLE_V1.md** — frontend-specific витяг
3. **PROPOSAL_SYSTEM_V1.md** — proposal UI контракт
4. **API_CONTRACTS_V1.md** — повні API schemas

### Для backend developer:
1. **RUNTIME_ARCHITECTURE_CANONICAL.md** — повна архітектура
2. **ORCHESTRATION_LAYER_ABSTRACTION.md** — adapter interface
3. **EXECUTION_PIPELINE_CANONICAL.md** — implementation guide
4. **STORAGE_AUTHORITY_MODEL_CANONICAL.md** — write/read rules
5. **AGENT_MEMORY_GIT_DIFFMEM_V1.md** — агентна пам'ять: структура, ліміти, eviction
6. **AGENT_LOGIC_VERSIONING_V1.md** — версіонування логіки: logic/, оптимізатор

---

## 3. Invariants Summary

Фундаментальні інваріанти системи (деталі у RUNTIME_ARCHITECTURE_CANONICAL.md §1):

| # | Інваріант | Документ-деталі |
|---|----------|-----------------|
| 1 | **Folder = Agent** — один агент = одна директорія у MinIO | RUNTIME_ARCHITECTURE_CANONICAL.md §2.1 |
| 2 | **MinIO = Source of Truth** — canonical storage для визначень, runs, proposals | STORAGE_AUTHORITY_MODEL_CANONICAL.md §1 |
| 3 | **`_agent.md` = Behavioral Contract** — визначення агента у MinIO | RUNTIME_ARCHITECTURE_CANONICAL.md §2.1 |
| 4 | **Mastra = Interpreter** — runtime, не source of truth | RUNTIME_ARCHITECTURE_CANONICAL.md §2.4 |
| 5 | **Proposal = Mutation Gate** — будь-яка зміна через approval | PROPOSAL_SYSTEM_V1.md §1 |
| 6 | **Frontend = Projection Layer** — відображає, не керує | RUNTIME_ARCHITECTURE_CANONICAL.md §2.6 |
| 7 | **Worker = Single Entrypoint** — єдиний gateway для frontend | RUNTIME_ARCHITECTURE_CANONICAL.md §2.5 |
| 8 | **Orchestration Layer = Replaceable** — vendor-agnostic координація | ORCHESTRATION_LAYER_ABSTRACTION.md §0 |
| 9 | **Status Writer = Orchestration Layer wrapper** — не Mastra | RUN_LIFECYCLE_CANONICAL.md §2 |
| 10 | **Memory = git monorepo** — `garden-bloom-memory`, ШАР 1 ≤ 12 000 токенів HARD | AGENT_MEMORY_GIT_DIFFMEM_V1.md §11 |
| 11 | **Logic = versioned per-agent** — `logic/<agentId>/`, logic-update завжди human review | AGENT_LOGIC_VERSIONING_V1.md §6 |

---

## 4. Component Roles

| Компонент | Роль | Canonical Doc |
|----------|------|--------------|
| **MinIO** | Canonical storage (definitions, runs, proposals) | STORAGE_AUTHORITY_MODEL_CANONICAL.md |
| **git monorepo `garden-bloom-memory`** | Canonical storage (memory, logic) | AGENT_MEMORY_GIT_DIFFMEM_V1.md §2.2 |
| **Orchestration Layer** | Coordination, durable execution | ORCHESTRATION_LAYER_ABSTRACTION.md |
| **Mastra** | Agent runtime interpreter | RUNTIME_ARCHITECTURE_CANONICAL.md §2.4 |
| **FastAPI** | NLM cognitive proxy | RUNTIME_ARCHITECTURE_CANONICAL.md §2.2 |
| **Worker** | API gateway | RUNTIME_ARCHITECTURE_CANONICAL.md §2.5 |
| **Frontend** | Projection layer | RUNTIME_ARCHITECTURE_CANONICAL.md §2.6 |
| **Optimizer agent** | Logic analysis, proposes logic-update Proposals | AGENT_LOGIC_VERSIONING_V1.md §4 |

---

## 5. Related Documents

### Frontend-specific
- **INBOX_AND_RUN_LIFECYCLE_V1.md** — frontend витяг lifecycle
- **PROPOSAL_SYSTEM_V1.md** — proposal UI контракт
- **API_CONTRACTS_V1.md** — повні API schemas
- **LOVABLE_УЗГОДЖЕННЯ_З_RUNTIME_АРХІТЕКТУРОЮ.md** — frontend ↔ runtime контракт
- **FRONTEND_V1_MIGRATION_PLAN.md** — frontend migration plan

### Architecture foundation
- **АРХІТЕКТУРНА_БАЗА_СИСТЕМИ.md** — архітектурна база
- **КОНТРАКТ_АГЕНТА_V1.md** — agent contract V1
- **INBOX_ТА_PROPOSAL_АРХІТЕКТУРА.md** — повна inbox/proposal архітектура

### Agent memory & logic (canonical)
- **AGENT_MEMORY_GIT_DIFFMEM_V1.md** — git-based агентна пам'ять, два шари, eviction model
- **AGENT_LOGIC_VERSIONING_V1.md** — версіонування логіки агентів, optimizer agent

### Migration (archived — див. `archive/orchestration-migrations/`)
- Міграційні документи переміщені до `archive/orchestration-migrations/`
- Canonical runtime docs (вище) є актуальними та vendor-agnostic

### Deprecated (archived)
- **~~ЦІЛЬОВА_АРХІТЕКТУРА_MASTRA_INNGEST.md~~** — замінено RUNTIME_ARCHITECTURE_CANONICAL.md (переміщено до `archive/deprecated/`)

---

*Цей документ є canonical entry point для runtime-архітектури Garden Seedling.*
