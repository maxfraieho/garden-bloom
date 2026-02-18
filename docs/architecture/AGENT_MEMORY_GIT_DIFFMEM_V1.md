# Agent Memory: Git-Based DiffMem Integration V1

> Створено: 2026-02-17
> Автор: Головний архітектор системи
> Статус: Канонічний архітектурний документ
> Мова: Українська (канонічна)
> Категорія: Runtime Architecture — Agent Memory Subsystem

---

## Зміст

1. [Архітектурний огляд DiffMem](#1-архітектурний-огляд-diffmem)
2. [Аналіз варіантів інтеграції](#2-аналіз-варіантів-інтеграції)
3. [Канонічна структура файлів пам'яті](#3-канонічна-структура-файлів-памяті)
4. [Модель доступу до пам'яті (Tools Design)](#4-модель-доступу-до-памяті-tools-design)
5. [Стратегія токен-економії](#5-стратегія-токен-економії)
6. [Модель аудиту та UX для людини](#6-модель-аудиту-та-ux-для-людини)
7. [Модель безпеки та відмовостійкості](#7-модель-безпеки-та-відмовостійкості)
8. [Інтеграція з існуючим Garden Bloom Runtime](#8-інтеграція-з-існуючим-garden-bloom-runtime)
9. [План міграції](#9-план-міграції)
10. [Фінальна рекомендація](#10-фінальна-рекомендація)

---

## 1. Архітектурний огляд DiffMem

### 1.1 Що таке DiffMem

DiffMem — це git-based система управління пам'яттю агентів, яка розділяє **поточний стан** (snapshot у Markdown-файлах) від **історичної еволюції** (git commit graph). Система створена для ефективного управління довготривалою пам'яттю AI-агентів без потреби у зовнішніх базах даних.

### 1.2 Внутрішня архітектура

DiffMem складається з чотирьох компонентів:

| Компонент | Роль |
|-----------|------|
| **Writer Agent** | Аналізує результати сесій агента, ідентифікує сутності, атомарно комітить зміни до git |
| **Context Manager** | Збирає контекст різної глибини: basic / wide / deep / temporal |
| **Searcher Agent** | BM25-пошук по поточному стану пам'яті з LLM-синтезом відповідей |
| **API Layer** | Чистий інтерфейс для зовнішньої інтеграції (read/write) |

### 1.3 Модель Snapshot vs Diff

- **Snapshot** — поточний стан зберігається як human-readable Markdown-файли. Це єдина поверхня для запитів.
- **Diff** — git зберігає повну історію змін. Агент може запитати "як змінився X?" через `git diff`, не завантажуючи весь архів.

Ця модель ідеально відповідає потребам Garden Bloom:
- Markdown-файли — це вже canonical формат архітектури
- Git — вже використовується як persistence layer для notes/DRAKON
- Людина може переглядати пам'ять звичайними інструментами (VS Code, GitHub)
- Token efficiency: завантажується лише поточний snapshot, не вся історія

### 1.4 Сумісність з інваріантами Garden Bloom

| Інваріант | Сумісність |
|-----------|-----------|
| MinIO = Source of Truth | ✅ Git-repo зберігається як об'єкт у MinIO або паралельно |
| Proposal = Mutation Gate | ✅ Запис пам'яті — через proposal lifecycle |
| Runtime = Stateless | ✅ Агент читає snapshot, не зберігає стан між runs |
| Orchestration Layer = Vendor-agnostic | ✅ Memory tools не залежать від оркестратора |
| Worker = Single Gateway | ✅ Memory mutations проходять через Worker |

### 1.5 Чому git-based пам'ять підходить для агентів

1. **Детерміністичність** — кожен snapshot має фіксований commit hash, відтворюваний стан
2. **Аудитабельність** — повна історія змін з авторством та часовими мітками
3. **Ефективність** — git diff замість повного перезавантаження; лише дельта змін
4. **Людська читабельність** — Markdown без спеціальних інструментів
5. **Конфлікт-резолюція** — git merge як стандартний механізм
6. **Zero-database** — жодних Postgres, Redis чи інших runtime-залежностей

---

## 2. Аналіз варіантів інтеграції

### Option A — Dedicated git repo per agent

**Архітектурна діаграма:**

```
MinIO (canonical storage)
└── agents/
    └── {slug}/
        └── memory.git/          ← bare git repo як об'єкт у MinIO
            ├── snapshot.md
            ├── facts.md
            ├── decisions.md
            └── ...

Worker клонує repo → Orchestration Layer читає →
Agent пропонує зміни → Proposal → Apply → git push
```

| Критерій | Оцінка |
|----------|--------|
| **Storage authority** | MinIO зберігає bare repos; git — внутрішній формат |
| **Аудитабельність** | ✅ Відмінна — повна git history per agent |
| **Масштабованість** | ⚠️ Обмежена — тисячі bare repos у MinIO ускладнюють управління |
| **Безпека** | ✅ Повна ізоляція між агентами |
| **Операційна складність** | ❌ Висока — управління N git repos, синхронізація, gc |
| **Token efficiency** | ✅ Відмінна — ізольований контекст |
| **Proposal lifecycle** | ✅ Природна — commit = applied proposal |

### Option B — Monorepo: `memory/<agentId>/`

**Архітектурна діаграма:**

```
agent-memory.git/                ← один git repo для всієї пам'яті
├── memory/
│   ├── archivist-violin/
│   │   ├── snapshot.md
│   │   ├── facts.md
│   │   └── ...
│   ├── research-owl/
│   │   ├── snapshot.md
│   │   └── ...
│   └── ...
└── .gitignore

Worker має один repo → фільтрує по agent path →
Agent працює лише зі своїм піддеревом
```

| Критерій | Оцінка |
|----------|--------|
| **Storage authority** | Один git repo — простий для зберігання в MinIO чи окремо |
| **Аудитабельність** | ✅ Добра — `git log -- memory/{slug}/` фільтрує по агенту |
| **Масштабованість** | ✅ Добра — один repo масштабується до сотень агентів |
| **Безпека** | ⚠️ Середня — всі агенти в одному repo, потрібна path-based ізоляція |
| **Операційна складність** | ✅ Низька — один repo, один gc, одна синхронізація |
| **Token efficiency** | ✅ Добра — читається лише піддерево агента |
| **Proposal lifecycle** | ✅ Природна — proposal вказує target path |

### Option C — Hybrid: MinIO canonical + periodic git export

**Архітектурна діаграма:**

```
MinIO (primary — canonical authority)
└── agents/{slug}/memory/
    ├── snapshot.md              ← canonical current state
    ├── facts.md
    └── ...

Git repo (secondary — audit/history)
└── memory/{slug}/               ← periodic export
    ├── snapshot.md
    └── ...

Sync job: MinIO → Git (cron, post-apply)
Audit: git log / git diff
Runtime reads: MinIO (canonical)
```

| Критерій | Оцінка |
|----------|--------|
| **Storage authority** | MinIO залишається canonical; git — derived audit layer |
| **Аудитабельність** | ✅ Добра, але з затримкою синхронізації |
| **Масштабованість** | ✅ Висока — MinIO масштабується нативно |
| **Безпека** | ✅ Добра — MinIO ACL + git read-only |
| **Операційна складність** | ⚠️ Середня — sync job як додатковий компонент |
| **Token efficiency** | ✅ Добра — runtime читає з MinIO |
| **Proposal lifecycle** | ✅ Повна — proposal → MinIO write → git sync |

### Порівняльна таблиця

| Критерій | Option A (per-agent repo) | Option B (monorepo) | Option C (hybrid) |
|----------|:------------------------:|:-------------------:|:-----------------:|
| Складність операцій | ❌ Висока | ✅ Низька | ⚠️ Середня |
| Аудитабельність | ✅ Відмінна | ✅ Добра | ✅ Добра |
| Масштабованість | ⚠️ Обмежена | ✅ Добра | ✅ Висока |
| Ізоляція агентів | ✅ Повна | ⚠️ Path-based | ✅ MinIO ACL |
| Token efficiency | ✅ Відмінна | ✅ Добра | ✅ Добра |
| Сумісність з MinIO | ⚠️ Складна | ✅ Проста | ✅ Природна |
| Proposal lifecycle | ✅ Природна | ✅ Природна | ✅ Природна |
| Відповідність інваріантам | ⚠️ Конфлікт authority | ✅ Повна | ✅ Повна |
| **Рекомендація** | Ні | **Так (V1)** | Можливо (V2) |

---

## 3. Канонічна структура файлів пам'яті

### 3.1 Директорна структура

```
memory/<agentId>/
├── snapshot.md              ← Консолідований поточний стан
├── facts.md                 ← Верифіковані факти та знання
├── open_loops.md            ← Незавершені задачі, відкриті питання
├── decisions.md             ← Прийняті рішення та їх обґрунтування
├── relationships.md         ← Зв'язки між сутностями
├── changelog.md             ← Людино-читабельний лог значущих змін
├── timeline/
│   └── YYYY-MM-DD.md        ← Щоденний журнал активності
└── runs/
    └── run_<id>.md           ← Артефакт конкретного запуску
```

### 3.2 Призначення та правила кожного файлу

| Файл | Призначення | Частота запису | Власник запису | Обмеження розміру | Ретенція |
|------|------------|---------------|----------------|-------------------|----------|
| `snapshot.md` | Зведений поточний стан агента — ключові факти, активні цілі, контекст | Після кожного run | Proposal (від Runtime) | ≤ 2K tokens | Перезаписується |
| `facts.md` | Верифіковані факти: дані, метрики, підтверджена інформація | Коли з'являються нові факти | Proposal (від Runtime) | ≤ 4K tokens | Append + periodic consolidation |
| `open_loops.md` | Незавершені дії, очікувані відповіді, blocking питання | Кожен run що створює/закриває loops | Proposal (від Runtime) | ≤ 2K tokens | Закриті loops видаляються |
| `decisions.md` | Прийняті рішення з контекстом, альтернативами, обґрунтуванням | Коли приймається значуще рішення | Proposal (від Runtime) | ≤ 4K tokens | Постійна |
| `relationships.md` | Граф зв'язків між сутностями (люди, проекти, теми) | Коли виявляються нові зв'язки | Proposal (від Runtime) | ≤ 2K tokens | Постійна |
| `changelog.md` | Human-readable лог значущих подій | Після кожного applied proposal | Worker (Apply Engine) | ≤ 8K tokens, rolling 90 days | Автоматична ротація |
| `timeline/YYYY-MM-DD.md` | Деталізований щоденний журнал | Після кожного run | Proposal (від Runtime) | ≤ 2K tokens per day | 30 днів, потім archival |
| `runs/run_<id>.md` | Результат конкретного run: що зроблено, що запропоновано | Один раз при finalize | Orchestration Layer wrapper | ≤ 1K tokens | 14 днів |

### 3.3 Формат файлів

Усі файли — **Markdown з YAML frontmatter**. Це забезпечує:
- Human-readability
- Diff-friendly формат
- Parseable метадані
- Сумісність з git

**Приклад `snapshot.md`:**

```markdown
---
agent: archivist-violin
updated_at: 2026-02-17T14:30:00Z
version: 47
run_id: run_2026-02-17_143000_abc123
---

# Поточний стан: Archivist Violin

## Активні цілі
- Каталогізація нових джерел з категорії "Архітектура ПЗ"
- Підготовка щотижневого дайджесту

## Ключовий контекст
- Останній дайджест: 2026-02-14
- Оброблено 12 нових джерел з 2026-02-10
- Очікується review від Owner на 3 proposals

## Обмеження
- Не обробляти джерела без явної категорії
- Максимум 5 proposals за один run
```

**Приклад `facts.md`:**

```markdown
---
agent: archivist-violin
updated_at: 2026-02-17T14:30:00Z
---

# Факти

## Джерела
- Загальна кількість каталогізованих джерел: 847
- Категорій: 23
- Останнє масове додавання: 2026-02-10 (12 джерел)

## Метрики
- Середній час обробки джерела: 45 секунд
- Acceptance rate proposals: 92%
- Rejection причини: 60% "дублікат", 30% "невірна категорія", 10% інше

## Правила Owner
- [2026-01-15] "Не додавай джерела старіші за 2024 рік"
- [2026-02-01] "Категорія 'AI Safety' має пріоритет"
```

### 3.4 Правила запису

1. **Runtime НЕ пише безпосередньо** — лише через `propose-memory-update()` tool
2. **Кожен запис = Proposal** — проходить стандартний lifecycle: `pending → approved → applying → applied`
3. **Atomic commits** — один proposal = один git commit при apply
4. **Idempotent updates** — повторне apply того ж proposal не створює дублікатів
5. **Owner може редагувати напряму** — через Worker UI, як звичайне редагування файлу

---

## 4. Модель доступу до пам'яті (Tools Design)

### 4.1 Архітектурні tools

Ці tools визначаються як частина agent tool registry у Mastra runtime. Вони не є окремими сервісами — це tool definitions, які runtime надає агенту під час виконання.

#### Tool: `read-memory`

**Призначення:** Читання поточного стану пам'яті агента з контролем глибини.

**Pseudo-JSON Request:**

```json
{
  "tool": "read-memory",
  "params": {
    "agent_id": "archivist-violin",
    "depth": "basic",
    "files": ["snapshot.md", "facts.md"],
    "query": "які джерела оброблені за останній тиждень?"
  }
}
```

**Pseudo-JSON Response:**

```json
{
  "status": "ok",
  "depth": "basic",
  "token_count": 1847,
  "content": {
    "snapshot.md": "# Поточний стан: Archivist Violin\n...",
    "facts.md": "# Факти\n## Джерела\n..."
  },
  "metadata": {
    "version": 47,
    "last_updated": "2026-02-17T14:30:00Z",
    "commit_hash": "a1b2c3d"
  }
}
```

#### Tool: `propose-memory-update`

**Призначення:** Створення proposal для оновлення пам'яті агента. НЕ пише напряму — створює proposal у стандартному lifecycle.

**Pseudo-JSON Request:**

```json
{
  "tool": "propose-memory-update",
  "params": {
    "agent_id": "archivist-violin",
    "run_id": "run_2026-02-17_143000_abc123",
    "updates": [
      {
        "file": "snapshot.md",
        "operation": "replace",
        "content": "# Поточний стан: Archivist Violin\n## Активні цілі\n- Підготовка щотижневого дайджесту\n..."
      },
      {
        "file": "facts.md",
        "operation": "append",
        "section": "## Джерела",
        "content": "- Загальна кількість каталогізованих джерел: 859 (+12)"
      },
      {
        "file": "open_loops.md",
        "operation": "remove_entry",
        "entry_id": "loop-review-pending-3"
      }
    ],
    "summary": "Оновлено після обробки 12 нових джерел",
    "auto_approve_eligible": true
  }
}
```

**Pseudo-JSON Response:**

```json
{
  "status": "proposal_created",
  "proposal_id": "prop_mem_2026-02-17_143500_def456",
  "proposal_status": "pending",
  "target_files": ["snapshot.md", "facts.md", "open_loops.md"],
  "estimated_diff_size": "342 bytes"
}
```

#### Tool: `memory-diff`

**Призначення:** Отримання diff між поточним станом пам'яті та попередньою версією. Для temporal queries.

**Pseudo-JSON Request:**

```json
{
  "tool": "memory-diff",
  "params": {
    "agent_id": "archivist-violin",
    "since": "2026-02-10",
    "files": ["facts.md", "decisions.md"],
    "format": "unified"
  }
}
```

**Pseudo-JSON Response:**

```json
{
  "status": "ok",
  "token_count": 523,
  "diffs": [
    {
      "file": "facts.md",
      "commits": 3,
      "diff": "@@ -5,3 +5,3 @@\n-Загальна кількість: 835\n+Загальна кількість: 859\n..."
    }
  ],
  "period": {
    "from": "2026-02-10T00:00:00Z",
    "to": "2026-02-17T14:30:00Z",
    "total_commits": 5
  }
}
```

#### Tool: `memory-snapshot`

**Призначення:** Генерація консолідованого snapshot пам'яті для включення у контекст агента. Це primary tool для побудови контексту перед виконанням.

**Pseudo-JSON Request:**

```json
{
  "tool": "memory-snapshot",
  "params": {
    "agent_id": "archivist-violin",
    "mode": "wide",
    "token_budget": 4096,
    "priority": ["snapshot.md", "open_loops.md", "facts.md"]
  }
}
```

**Pseudo-JSON Response:**

```json
{
  "status": "ok",
  "mode": "wide",
  "token_count": 3847,
  "token_budget": 4096,
  "included_files": ["snapshot.md", "open_loops.md", "facts.md", "decisions.md"],
  "truncated_files": ["decisions.md"],
  "excluded_files": ["relationships.md", "changelog.md"],
  "snapshot": "# Agent Memory: archivist-violin\n\n## snapshot.md\n...\n\n## open_loops.md\n...",
  "version": 47,
  "commit_hash": "a1b2c3d"
}
```

### 4.2 Режими snapshot

| Режим | Що включає | Типовий розмір | Використання |
|-------|-----------|---------------|-------------|
| **basic** | Лише `snapshot.md` | ~1-2K tokens | Швидкі перевірки, прості задачі |
| **wide** | snapshot + open_loops + facts + decisions (з пріоритезацією) | ~4-8K tokens | Стандартний run агента |
| **deep** | Усі файли пам'яті повністю | ~8-16K tokens | Складні задачі, повний контекст |
| **temporal** | wide + git diffs за вказаний період | ~8-32K tokens | Аналіз змін, trend detection |

### 4.3 Детерміністична побудова контексту

Алгоритм побудови snapshot:

```
1. Визначити token_budget (з конфігурації або параметра)
2. Завантажити файли у порядку пріоритету:
   priority_order = [snapshot.md, open_loops.md, facts.md, decisions.md, relationships.md, changelog.md]
3. Для кожного файлу:
   a. Якщо файл вміщується повністю → включити
   b. Якщо не вміщується → truncate до залишку бюджету
   c. Якщо бюджет вичерпано → exclude, записати в excluded_files
4. Додати metadata header (version, commit_hash, timestamp)
5. Повернути consolidated snapshot
```

**Детермінізм гарантується:** один і той же commit_hash + mode + budget завжди дає ідентичний snapshot.

### 4.4 Token budget management

```
Загальний контекст агента ≈ 128K tokens (типовий LLM window)

Розподіл бюджету:
├── System prompt (_agent.md)     ≤  4K tokens
├── Sources (knowledge base)      ≤ 32K tokens
├── Memory snapshot               ≤  8K tokens  ← MEMORY BUDGET
├── Current task context          ≤ 16K tokens
├── Tool results buffer           ≤ 32K tokens
└── Generation buffer             ≤ 36K tokens
```

---

## 5. Стратегія токен-економії

### 5.1 Як git-пам'ять зменшує залежність від NotebookLM

Поточна архітектура використовує NotebookLM (через FastAPI proxy) як когнітивний сервіс для обробки великих обсягів джерел. Git-based пам'ять створює **кешований шар знань**, який зменшує кількість звернень до NLM.

**Механізм економії:**

```
БЕЗ пам'яті:
  Кожен run → NLM query ("що ми знаємо про X?") → 10-30K tokens input → відповідь

З пам'яттю:
  Кожен run → read-memory(basic) → 2K tokens → перевірка чи є відповідь у facts.md
  Якщо є → використати cached knowledge → 0 NLM tokens
  Якщо немає → NLM query → зберегти результат у facts.md → наступний run не потребує NLM
```

**Очікувана економія:** 40-70% зменшення NLM запитів після 10+ runs одного агента.

### 5.2 Правила вибору джерела знань

| Ситуація | Джерело | Обґрунтування |
|----------|---------|---------------|
| Факт вже є у `facts.md` з датою < 7 днів | **Memory snapshot** | Cached, 0 NLM tokens |
| Факт є у `facts.md` з датою > 7 днів | **Memory + NLM verification** | Перевірка актуальності |
| Факт відсутній у пам'яті | **NLM query** → зберегти в пам'ять | First-time extraction |
| Складний аналіз кількох джерел | **NLM query** (deep analysis) | Memory не замінює reasoning |
| Контекст попередніх рішень агента | **Memory snapshot** | decisions.md canonical |
| Тренд-аналіз за період | **Memory temporal diff** | git history ефективніший за NLM |
| Новий агент, пуста пам'ять | **NLM query** повністю | Bootstrap phase |
| Інформація відсутня і в NLM, і в пам'яті | **Жодне** — відзначити як open_loop | Чесність > галюцинації |

### 5.3 Цільові розміри snapshot

| Рівень | Token budget | Склад | Типовий use case |
|--------|-------------|-------|-----------------|
| **Micro** | ≤ 1K | Лише top-3 факти з snapshot.md | Health check, status query |
| **Standard** | ≤ 4K | snapshot.md + open_loops.md | Типовий run |
| **Extended** | ≤ 8K | Повний wide snapshot | Складна задача |
| **Full** | ≤ 16K | Deep + recent timeline | Debugging, audit |
| **Temporal** | ≤ 32K | Full + git diffs за період | Trend analysis |

### 5.4 Алгоритм пріоритезації

```
FUNCTION prioritize_memory_content(files, budget):
    result = []
    remaining = budget

    # Phase 1: Обов'язковий контекст
    snapshot = load("snapshot.md")
    IF size(snapshot) <= remaining:
        result.append(snapshot)
        remaining -= size(snapshot)
    ELSE:
        result.append(truncate(snapshot, remaining))
        RETURN result

    # Phase 2: Активні задачі
    loops = load("open_loops.md")
    IF loops AND size(loops) <= remaining:
        result.append(loops)
        remaining -= size(loops)

    # Phase 3: Факти (найрелевантніші секції)
    facts = load("facts.md")
    IF facts AND remaining > 500:
        relevant = extract_relevant_sections(facts, current_task)
        result.append(truncate(relevant, remaining))
        remaining -= size(relevant)

    # Phase 4: Рішення (якщо ще є бюджет)
    IF remaining > 500:
        decisions = load("decisions.md")
        result.append(truncate(decisions, remaining))

    RETURN result
```

---

## 6. Модель аудиту та UX для людини

### 6.1 Перегляд пам'яті агента

Людина має три канали доступу до пам'яті агента:

**Канал 1: Frontend UI (Lovable)**

```
Agent Dashboard → Agent Card → Memory Tab
├── Current Snapshot (rendered Markdown)
├── Facts Summary
├── Open Loops (actionable list)
├── Recent Changes (last 7 days)
└── Full Memory (expandable)
```

Frontend читає memory files через Worker API:
```
GET /agents/{slug}/memory/snapshot.md → rendered content
GET /agents/{slug}/memory/ → file listing
```

**Канал 2: Git History (CLI/IDE)**

```bash
# Переглянути поточний стан
cat memory/archivist-violin/snapshot.md

# Історія змін конкретного файлу
git log --oneline -- memory/archivist-violin/facts.md

# Diff за останній тиждень
git diff HEAD~7 -- memory/archivist-violin/

# Хто і коли змінював
git blame memory/archivist-violin/decisions.md

# Стан пам'яті на конкретну дату
git show HEAD~30:memory/archivist-violin/snapshot.md
```

**Канал 3: MinIO Console (Direct)**

```
MinIO Browser → agents/{slug}/memory/ → файли
```

### 6.2 Аудит змін

Кожна зміна пам'яті проходить через повний audit trail:

```
Run started (run_id)
    → Agent виконує задачу
    → Agent викликає propose-memory-update()
    → Proposal створено (proposal_id)
        → Зберігається в proposals/{proposal_id}.json
        → Містить: run_id, diff, summary, auto_approve_eligible
    → Owner reviews (або auto-approve)
    → Apply Engine виконує:
        1. Git checkout memory/{agentId}/
        2. Apply diff
        3. Git commit з message:
           "memory: {summary} [run:{run_id}] [proposal:{proposal_id}]"
        4. Update changelog.md
        5. Push to canonical repo
    → Proposal status → applied
```

### 6.3 Трасування: run → proposal → memory update

Кожен елемент ланцюга має cross-references:

| Артефакт | Посилається на |
|----------|---------------|
| `runs/{runId}/manifest.json` | `proposals_created: [proposal_ids]` |
| `proposals/{propId}.json` | `run_id`, `target_files`, `memory_diff` |
| Git commit message | `[run:{runId}]`, `[proposal:{propId}]` |
| `changelog.md` entry | `run_id`, `proposal_id`, date, summary |

**Приклад git log:**

```
a1b2c3d memory: оновлено після обробки 12 джерел [run:run_2026-02-17_143000_abc] [proposal:prop_mem_def456]
e4f5g6h memory: закрито 2 open loops [run:run_2026-02-16_090000_ghi] [proposal:prop_mem_jkl789]
m7n8o9p memory: додано рішення про нову категорію [run:run_2026-02-15_160000_mno] [proposal:prop_mem_pqr012]
```

### 6.4 Human override

Owner завжди може:
1. **Редагувати пам'ять напряму** — через Worker UI або git commit
2. **Відхилити memory proposal** — reject з причиною
3. **Скинути пам'ять** — видалити файли (новий run створить порожній snapshot)
4. **Заморозити пам'ять** — встановити `readonly: true` у конфігурації

---

## 7. Модель безпеки та відмовостійкості

### 7.1 Ризики та мітигації

#### Ризик 1: Prompt injection через пам'ять

**Загроза:** Зловмисний контент у `facts.md` або `snapshot.md` може містити інструкції, що змінять поведінку агента.

**Мітигація:**
- Proposal review — Owner бачить повний diff перед approved
- Content sanitization — видалення markdown-інструкцій (`# SYSTEM:`, `[INST]`, тощо) при read-memory
- Separation of concerns — memory content ніколи не інтерпретується як system prompt
- Auto-approve rules — НЕ застосовуються до файлів з підозрілими паттернами

#### Ризик 2: Corrupted memory (пошкоджена пам'ять)

**Загроза:** Agent помилково пише невалідний Markdown, невірні факти, або перезаписує критичний контекст.

**Мітигація:**
- YAML frontmatter validation — перевірка структури перед apply
- Git revert — будь-який commit можна відкотити: `git revert <hash>`
- Backup snapshots — щоденний snapshot у `timeline/YYYY-MM-DD.md`
- Size guards — файл > max розміру блокується на рівні proposal

#### Ризик 3: Concurrent memory updates

**Загроза:** Два runs одного агента намагаються оновити пам'ять одночасно.

**Мітигація:**
- Concurrency limit: max 1 run per agent (Orchestration Layer invariant)
- Optimistic concurrency: proposal зберігає `base_version`, apply перевіряє
- Sequential proposals: FIFO ordering на рівні apply engine

#### Ризик 4: Proposal conflicts (конфлікт proposals)

**Загроза:** Два proposals від різних runs змінюють один файл.

**Мітигація:**
- FIFO apply ordering — перший applied, другий conflict-checked
- Base version tracking — proposal створюється з `base_commit_hash`
- Conflict resolution — при конфлікті proposal переходить у `failed` з причиною `conflict`
- Owner може force-apply або створити новий proposal

#### Ризик 5: Unauthorized memory mutation

**Загроза:** Компонент обходить Proposal lifecycle і пише напряму.

**Мітигація:**
- Write Authority Matrix — лише Orchestration Layer wrapper + Worker мають write access
- MinIO bucket policies — runtime (Mastra) має read-only credentials для memory path
- Audit log — кожен write до memory/ логується в audit/
- Git hooks — pre-commit hook перевіряє що автор = authorized writer

#### Ризик 6: Memory bloat (неконтрольоване зростання)

**Загроза:** Агент накопичує нерелевантний контент, розмір пам'яті перевищує token budget.

**Мітигація:**
- Size constraints per file (див. §3.2)
- Consolidation policy — periodic merge timeline entries → facts/decisions
- Retention rules — runs/ зберігаються 14 днів, timeline/ 30 днів
- Owner cleanup — можливість ручного review та pruning

### 7.2 Failure modes та recovery

| Failure | Вплив | Recovery |
|---------|-------|----------|
| Git repo corrupted | Пам'ять недоступна | Re-clone з MinIO canonical; MinIO = source of truth |
| MinIO memory files lost | Canonical data lost | Git repo = secondary backup; restore від git |
| Apply Engine crash mid-commit | Partial write | Git atomic commits — або committed, або ні; retry proposal |
| Agent writes invalid Markdown | Malformed memory | YAML validation gate; reject proposal |
| Sync job failure (Option C) | Git audit delayed | Non-critical; MinIO canonical не постраждає |

---

## 8. Інтеграція з існуючим Garden Bloom Runtime

### 8.1 Gateway (Worker)

**Нові endpoints:**

```
GET  /agents/{slug}/memory/                → listing memory files
GET  /agents/{slug}/memory/{filename}      → read specific memory file
GET  /agents/{slug}/memory/snapshot?mode=   → consolidated snapshot
GET  /agents/{slug}/memory/diff?since=      → git diff
```

**Mutation path (без змін до поточного):**

```
propose-memory-update() → Proposal створюється стандартно →
Worker Apply Engine → git commit + MinIO write
```

Worker не потребує нових mutation endpoints — memory proposals використовують існуючий proposal apply flow.

### 8.2 Proposal lifecycle

Memory proposals — це **стандартні proposals** з додатковими полями:

```json
{
  "proposal_id": "prop_mem_...",
  "type": "memory_update",
  "agent_slug": "archivist-violin",
  "run_id": "run_...",
  "target_path": "memory/archivist-violin/",
  "files": [
    {
      "path": "snapshot.md",
      "operation": "replace",
      "diff": "@@ -3,1 +3,1 @@\n-version: 46\n+version: 47"
    }
  ],
  "base_commit_hash": "a1b2c3d",
  "auto_approve_eligible": true,
  "status": "pending"
}
```

**Стандартний lifecycle:**
```
pending → approved/auto_approved → applying → applied/failed
```

**Auto-approve критерії для memory proposals:**
- Файли лише в `memory/{own_agent_id}/` (не чужа пам'ять)
- Diff size ≤ 1K bytes
- Відсутні підозрілі паттерни (injection markers)
- Owner дозволив auto-approve для цього агента

### 8.3 Execution Pipeline

Зміни до 7-фазної pipeline:

**Phase 3 (Load Context) — розширення:**

```
Orchestration Layer Step 1: Load Context
  1. Read _agent.md         ← існуючий
  2. Read sources/*         ← існуючий
  3. Read memory snapshot   ← НОВИЙ: memory-snapshot(mode=wide)
  4. Build agent context    ← включає memory
```

**Phase 4 (Execute Agent) — без змін:**

Mastra agent отримує memory як частину контексту. Має tools: `read-memory`, `propose-memory-update`, `memory-diff`. Використовує їх за потреби під час reasoning loop.

**Phase 5 (Persist Results) — розширення:**

```
Orchestration Layer Step 3: Persist Results
  1. Save proposals         ← існуючий
  2. Save memory proposals  ← НОВИЙ: memory updates як окремі proposals
  3. Write run manifest     ← включає memory_proposals_created
```

### 8.4 Orchestration Layer

Orchestration Layer wrapper отримує додаткову відповідальність:
- Завантаження memory snapshot у Phase 3
- Збереження memory proposals у Phase 5
- Оновлення `changelog.md` після successful apply

**Це НЕ порушує vendor-agnostic абстракцію** — memory operations визначаються через стандартний adapter interface як додаткові steps.

### 8.5 Canonical storage model

Memory files стають частиною canonical MinIO hierarchy:

```
agents/{slug}/
├── _agent.md
├── sources/
├── memory/              ← НОВИЙ canonical path
│   ├── snapshot.md
│   ├── facts.md
│   ├── open_loops.md
│   ├── decisions.md
│   ├── relationships.md
│   ├── changelog.md
│   ├── timeline/
│   └── runs/
├── runs/
├── proposals/
└── artifacts/
```

**Write Authority Matrix — розширення:**

| Path | Canonical Writer | Коли |
|------|------------------|------|
| `agents/{slug}/memory/snapshot.md` | Orchestration Layer wrapper (через Proposal) | Post-run |
| `agents/{slug}/memory/facts.md` | Orchestration Layer wrapper (через Proposal) | Коли є нові факти |
| `agents/{slug}/memory/changelog.md` | Worker (Apply Engine) | Після apply memory proposal |
| `agents/{slug}/memory/timeline/*` | Orchestration Layer wrapper (через Proposal) | Post-run |
| `agents/{slug}/memory/runs/*` | Orchestration Layer wrapper | Run finalize |

**Anti-patterns:**
- ❌ Mastra НЕ пише memory напряму
- ❌ Frontend НЕ читає memory напряму (через Worker)
- ❌ Один агент НЕ може писати пам'ять іншого агента

### 8.6 Відповідність canonical runtime invariants

| Інваріант | Як зберігається |
|-----------|----------------|
| MinIO = Source of Truth | Memory files canonical у MinIO; git repo = derived |
| Proposal = Mutation Gate | Всі memory writes через proposals |
| Runtime = Stateless | Agent читає snapshot per-run, не кешує між runs |
| Worker = Single Gateway | Memory reads/writes через Worker API |
| Orchestration Layer = Replaceable | Memory tools — стандартні tool definitions |
| Status Writer = Orchestration Layer wrapper | Memory write status в run status.json |
| Frontend = Projection | Frontend відображає memory, не мутує |

---

## 9. План міграції

### Phase 0 — Documentation Only (тиждень 1)

**Дії:**
- ✅ Створити цей документ (AGENT_MEMORY_GIT_DIFFMEM_V1.md)
- Додати посилання до RUNTIME_ARCHITECTURE_INDEX.md
- Оновити STORAGE_AUTHORITY_MODEL_CANONICAL.md з memory paths
- Review з Owner

**Ризик:** Нульовий — лише документація.
**Rollback:** Видалити документ.

### Phase 1 — Introduce Memory Layout (тиждень 2-3)

**Дії:**
- Створити `memory/` directory structure у MinIO для кожного існуючого агента
- Ініціалізувати порожні `snapshot.md` з базовим frontmatter
- Ініціалізувати git repo (monorepo) для memory tracking
- Додати git hooks для validation

**Ризик:** Мінімальний — порожні файли, runtime не залежить від них.
**Rollback:** Видалити `memory/` directories.

### Phase 2 — Introduce Memory Tools (тиждень 4-5)

**Дії:**
- Реалізувати `read-memory` tool у Mastra tool registry
- Реалізувати `memory-snapshot` tool
- Додати memory snapshot до Phase 3 (Load Context) як optional
- Feature flag: `AGENT_MEMORY_ENABLED=false` (disabled by default)

**Ризик:** Низький — tools readonly, feature flag вимкнено.
**Rollback:** Видалити tools з registry, прибрати Phase 3 розширення.

### Phase 3 — Agents Start Writing Memory (тиждень 6-8)

**Дії:**
- Реалізувати `propose-memory-update` tool
- Додати memory proposals до Phase 5 (Persist Results)
- Увімкнути для одного тестового агента: `AGENT_MEMORY_ENABLED=true` per agent
- Monitor: розмір proposals, apply success rate, content quality
- Owner review кожного memory proposal (no auto-approve)

**Ризик:** Середній — агент починає писати пам'ять.
**Rollback:** Вимкнути flag, очистити memory files, git revert.

### Phase 4 — Reduce NotebookLM Reliance (тиждень 9-12)

**Дії:**
- Реалізувати `memory-diff` tool
- Додати logic: "перевір пам'ять перед NLM query"
- Увімкнути auto-approve для memory proposals за критеріями §8.2
- Увімкнути для всіх агентів поступово
- Вимірювати: NLM queries before/after, token usage, agent quality

**Ризик:** Середній — зменшення NLM може вплинути на якість.
**Rollback:** Вимкнути "memory-first" logic, повернути NLM queries.

### Phase 5 — Full Production Usage (тиждень 13+)

**Дії:**
- Memory = стандартна частина кожного agent run
- Consolidation jobs для memory maintenance
- Timeline retention enforcement
- Dashboard: memory health, size trends, NLM savings
- Remove feature flag: memory завжди увімкнена

**Ризик:** Низький на цьому етапі — перевірено у phases 3-4.
**Rollback:** Повернути flag-based control якщо потрібно.

### Кожна фаза безпечна та оборотна

```
Phase 0 → Phase 1: лише файли, runtime не залежить
Phase 1 → Phase 2: readonly tools, feature flag off
Phase 2 → Phase 3: один агент, manual review
Phase 3 → Phase 4: поступове розширення
Phase 4 → Phase 5: вже перевірено у production
```

---

## 10. Фінальна рекомендація

### Рекомендований варіант: Option B — Monorepo (`memory/<agentId>/`)

### Обґрунтування

**Option B обирається як V1 canonical approach з наступних причин:**

1. **Мінімальна операційна складність.** Один git repo для всієї пам'яті — один gc, одна синхронізація, один backup. Option A (per-agent repos) створює O(N) операційне навантаження, що неприйнятно при масштабуванні.

2. **Повна сумісність з MinIO authority model.** Memory files зберігаються у canonical MinIO hierarchy (`agents/{slug}/memory/`), git repo є derived audit layer. Це зберігає інваріант "MinIO = Source of Truth" без конфлікту authority.

3. **Природна інтеграція з Proposal lifecycle.** Memory proposals — стандартні proposals з додатковими полями. Не потребує нових mutation flows, apply engine, чи approval UI. Максимальне повторне використання існуючої інфраструктури.

4. **Git history per-agent через path filtering.** `git log -- memory/{slug}/` надає повну ізольовану історію для кожного агента без потреби у окремих repos. `git diff -- memory/{slug}/` для temporal queries.

5. **Ефективний path до Option C (Hybrid) у майбутньому.** Якщо масштаб вимагатиме — monorepo природно еволюціонує у hybrid через додавання sync layer. Це не потребує рефакторингу memory layout чи tool API.

6. **Token efficiency.** Markdown snapshots замість database queries. Один `snapshot.md` (≤2K tokens) замінює кілька NLM запитів. Git diff замість повного перезавантаження контексту.

7. **Vendor-agnostic.** Git + файлова система. Нульова залежність від Postgres, Redis, чи будь-якої managed service. Портабельна між будь-якими середовищами.

### Чому Option B перевищує альтернативи

| Фактор | Option A проблема | Option C проблема | Option B рішення |
|--------|-------------------|-------------------|-----------------|
| Складність | N repos = N × operations | Sync job = new failure mode | 1 repo = 1 × operations |
| Authority | Git vs MinIO conflict | Dual source, eventual consistency | MinIO canonical, git derived |
| V1 readiness | Потребує repo management infra | Потребує sync infrastructure | Готова до реалізації |

### V1 Canonical Architecture Summary

```
MinIO (canonical authority)
└── agents/{slug}/memory/    ← canonical files, source of truth

Git monorepo (audit layer)
└── memory/{slug}/           ← derived, git history for audit

Flow:
  Agent run → read-memory(snapshot) → execute → propose-memory-update()
  → Proposal lifecycle → Apply Engine → MinIO write + git commit
  → changelog.md updated → audit complete

Invariants preserved: ✅ all 9 canonical invariants maintained
```

---

## Додаток A: Глосарій

| Термін | Визначення |
|--------|-----------|
| **Memory Snapshot** | Консолідований поточний стан пам'яті агента у Markdown |
| **Memory Proposal** | Proposal типу `memory_update` що змінює файли пам'яті |
| **Token Budget** | Максимальна кількість tokens виділена для memory контексту |
| **Consolidation** | Процес злиття temporal entries у canonical files |
| **Base Version** | Commit hash на момент створення proposal (для conflict detection) |

## Додаток B: Canonical References

| Документ | Зв'язок |
|----------|---------|
| RUNTIME_ARCHITECTURE_CANONICAL.md | Головна архітектура, інваріанти |
| STORAGE_AUTHORITY_MODEL_CANONICAL.md | Write/Read authority matrix |
| ORCHESTRATION_LAYER_ABSTRACTION.md | Adapter interface для memory steps |
| RUN_LIFECYCLE_CANONICAL.md | Status machine, memory у finalize |
| EXECUTION_PIPELINE_CANONICAL.md | Phases 3, 5 розширення |
| PROPOSAL_SYSTEM_V1.md | Memory proposal lifecycle |

---

*Цей документ є канонічним архітектурним описом Agent Memory Subsystem для Garden Bloom.*
*Версія: V1 | Статус: Draft for Review*
