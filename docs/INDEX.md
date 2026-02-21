# Garden Bloom: Документаційний індекс

> Оновлено: 2026-02-21
> Мова: Українська (канонічна)
> Статус: Єдина точка входу для читача та NotebookLM

---

## Що таке Garden Bloom?

**Garden Bloom** — execution platform для AI-агентів, де людина залишається в контролі. Агенти читають знання, виконують задачі та **пропонують** зміни через Proposal system — власник вирішує, що прийняти. Кожна мутація — через явну згоду, кожен крок — в аудит-лозі.

Коротко: **AI, який пропонує — людина, яка вирішує.**

Детальніший технічний опис: [PROJECT_DESCRIPTION_CANONICAL.md](PROJECT_DESCRIPTION_CANONICAL.md)
Філософія та бачення: [manifesto/MANIFESTO.md](manifesto/MANIFESTO.md)
Продуктова стратегія: [product/PRODUCT_STRATEGY.md](product/PRODUCT_STRATEGY.md)

---

## Маршрути читання

### A. Новий читач (з нуля)

```
1. manifesto/MANIFESTO.md                          — чому і навіщо
2. PROJECT_DESCRIPTION_CANONICAL.md                — що це технічно
3. architecture/RUNTIME_ARCHITECTURE_INDEX.md      — master index архітектури
4. architecture/RUNTIME_ARCHITECTURE_CANONICAL.md  — повна архітектура
5. architecture/КОНТРАКТ_АГЕНТА_V1.md              — що таке агент
6. architecture/EXECUTION_PIPELINE_CANONICAL.md    — як виконується run
```

### B. Frontend розробник (Lovable)

```
1. architecture/RUNTIME_ARCHITECTURE_INDEX.md      — орієнтація
2. architecture/INBOX_AND_RUN_LIFECYCLE_V1.md      — lifecycle для UI
3. architecture/PROPOSAL_SYSTEM_V1.md              — Proposal state machine
4. backend/API_CONTRACTS_V1.md                     — API schemas
5. frontend/LOVABLE_УЗГОДЖЕННЯ_З_RUNTIME_АРХІТЕКТУРОЮ.md — контракт з архітектурою
6. frontend/FRONTEND_ALIGNMENT_DIRECTIVE_V1.md     — критичні невідповідності
```

### C. Backend / Gateway розробник

```
1. architecture/RUNTIME_ARCHITECTURE_CANONICAL.md  — загальна архітектура
2. architecture/STORAGE_AUTHORITY_MODEL_CANONICAL.md — хто що пише/читає
3. architecture/EXECUTION_PIPELINE_CANONICAL.md    — pipeline деталі
4. architecture/RUN_LIFECYCLE_CANONICAL.md         — стани run
5. backend/API_CONTRACTS_V1.md                     — API contracts
6. architecture/БЕЗПЕКА_СИСТЕМИ.md                 — security principles
```

### D. Orchestration / Runtime розробник

```
1. architecture/ORCHESTRATION_LAYER_ABSTRACTION.md — vendor-agnostic контракт
2. architecture/EXECUTION_PIPELINE_CANONICAL.md    — pipeline кроки
3. architecture/AGENT_MEMORY_GIT_DIFFMEM_V1.md     — модель пам'яті агента
4. architecture/AGENT_LOGIC_VERSIONING_V1.md       — версіонування логіки
5. architecture/КОНТРАКТ_АГЕНТА_V1.md              — що отримує Mastra
6. architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА.md   — Proposal lifecycle
```

---

## NotebookLM: канонічний набір (Tier 1)

Ці документи є **єдиним авторитетним джерелом** архітектури Garden Bloom.
Додавати до NotebookLM **тільки** їх.

### Філософія та бачення
| Файл | Опис |
|------|------|
| `manifesto/MANIFESTO.md` | Конституція проекту: "Everything is an Agent" |
| `manifesto/PHILOSOPHY_EVERYTHING_AGENT.md` | Розширена філософія агентів |
| `manifesto/GLOSSARY.md` | Глосарій термінів |
| `PROJECT_DESCRIPTION_CANONICAL.md` | Executive overview системи |
| `product/PRODUCT_STRATEGY.md` | Продуктова стратегія, аудиторія, бізнес-модель |

### Канонічна архітектура
| Файл | Опис |
|------|------|
| `architecture/RUNTIME_ARCHITECTURE_INDEX.md` | Master index — починати звідси |
| `architecture/RUNTIME_ARCHITECTURE_CANONICAL.md` | Повна vendor-agnostic архітектура |
| `architecture/АРХІТЕКТУРНА_БАЗА_СИСТЕМИ.md` | Системні інваріанти та принципи |
| `architecture/КОНТРАКТ_АГЕНТА_V1.md` | Контракт агента v1.1 |
| `architecture/AGENT_MEMORY_GIT_DIFFMEM_V1.md` | Git-based пам'ять агента, HARD ліміти |
| `architecture/AGENT_LOGIC_VERSIONING_V1.md` | Версіонування логіки агента |
| `architecture/EXECUTION_PIPELINE_CANONICAL.md` | Pipeline від trigger до terminal state |
| `architecture/RUN_LIFECYCLE_CANONICAL.md` | Стани run: state machine |
| `architecture/STORAGE_AUTHORITY_MODEL_CANONICAL.md` | Хто що пише: authority matrix |
| `architecture/ORCHESTRATION_LAYER_ABSTRACTION.md` | Orchestration Layer: vendor-agnostic контракт |
| `architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА.md` | Proposal system: повна специфікація |
| `architecture/DRAKON_ІНТЕГРАЦІЯ_ТА_МОДЕЛЬ_ВИКОНАННЯ_АГЕНТА.md` | DRAKON як canonical logic format |
| `architecture/БЕЗПЕКА_СИСТЕМИ.md` | Security principles |

### API та контракти
| Файл | Опис |
|------|------|
| `backend/API_CONTRACTS_V1.md` | Повні API schemas та endpoints |

**Разом Tier 1: 19 файлів**

---

## Supporting документи (Tier 2)

Корисні для реалізації, але **не додавати до NotebookLM** (дублюють Tier 1 або є implementation guides).

| Файл | Аудиторія | Примітка |
|------|-----------|----------|
| `architecture/PROPOSAL_SYSTEM_V1.md` | Frontend dev | Витяг з INBOX_ТА_PROPOSAL_АРХІТЕКТУРА.md для Lovable |
| `architecture/INBOX_AND_RUN_LIFECYCLE_V1.md` | Frontend dev | UI-орієнтований lifecycle |
| `architecture/LANGUAGE_CANONICALIZATION.md` | Всі | Мовна политика (32 рядки) |
| `architecture/АРХІТЕКТУРНИЙ_АУДИТ_ТА_УЗГОДЖЕНІСТЬ_FINAL.md` | Architects | Архівний аудит узгодженості |
| `architecture/DOCUMENTATION_INVENTORY.md` | Doc maintainers | Інвентар документації |
| `frontend/LOVABLE_УЗГОДЖЕННЯ_З_RUNTIME_АРХІТЕКТУРОЮ.md` | Frontend dev | Контракт Lovable з архітектурою |
| `frontend/FRONTEND_ALIGNMENT_DIRECTIVE_V1.md` | Frontend dev | Критичні невідповідності UI |
| `frontend/FRONTEND_V1_MIGRATION_PLAN.md` | Frontend dev | Міграційний план (historical) |
| `drakon/INTEGRATION_STRATEGY_UA.md` | Implementers | Стратегія інтеграції DrakonWidget |
| `drakon/DRAKONWIDGET_RESEARCH_UA.md` | Implementers | Дослідження DrakonWidget |
| `drakon/IMPLEMENTATION_CHECKLIST_UA.md` | Implementers | Чеклист впровадження |
| `drakon/LOVABLE_AGENT_PROMPT_UA.md` | Lovable agent | Prompt для Lovable |
| `NOTEBOOKLM_AUDIO_PROMPT.md` | NotebookLM | Prompt для audio overview |

---

## Архів

Матеріали з інших проектів (gh-aw: GitHub Agentic Workflows) знаходяться в `_quarantine/`:
- `_quarantine/docs-scratchpad/` — робочі нотатки gh-aw (Go, GitHub Actions, CLI)
- `_quarantine/docs-specs/` — W3C-style specs gh-aw
- `_quarantine/docs-research/` — blog research gh-aw

**Не додавати до NotebookLM.**

---

*Цей файл — єдина точка входу до документації Garden Bloom.*
