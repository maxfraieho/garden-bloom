# Lovable Prompt — Agent Registry UI + Docs Audit

**Два незалежних завдання. Виконуй послідовно.**

---

## Обов'язкове читання перед початком

| Файл | Що описує |
|------|-----------|
| `docs/ІНДЕКС.md` | Майстер-індекс всієї документації |
| `docs/КАРТА_СИСТЕМИ.md` | Системна карта Garden Bloom |
| `docs/architecture/core/КОНТРАКТ_АГЕНТА_V1.md` | Канонічний контракт агента — що таке агент, його зони, поведінка |
| `docs/architecture/core/КАНОНІЧНИЙ_КОНВЕЄР_ВИКОНАННЯ.md` | Execution pipeline — порядок запуску агентів |
| `docs/architecture/core/АБСТРАКЦІЯ_РІВНЯ_ОРКЕСТРАЦІЇ.md` | Рівень оркестрації — як агенти координуються |
| `docs/architecture/governance/КАНОНІЧНА_СИСТЕМА_ТЕГУВАННЯ.md` | Таксономія тегів — domain, status, format, feature, tier |
| `docs/operations/ПРОТОКОЛ_АРХІТЕКТОРА.md` | Роль архітектора-оркестратора |

---

## TASK A — Agent Registry UI

### Концепція

Користувач-власник повинен мати змогу **оголошувати агентів** прямо з інтерфейсу.

Агент у системі — це:
- **Делегована зона** — папка в knowledge base (`exodus.pp.ua/architecture/`, `exodus.pp.ua/operations/` тощо)
- **Псевдокод поведінки** — текстовий опис того, що агент робить зі своєю зоною (на вхід: подія / задача, на вихід: дії)
- **Порядковий номер** — позиція в execution pipeline
- **Статус** — `active` / `inactive` / `draft`

Агентів може бути багато. Вони виконуються послідовно за `order`.

### Зберігання

Кожен агент — окремий markdown-файл у `docs/agents/{agent-id}.md`:

```markdown
---
id: "architecture-guardian"
name: "Architecture Guardian"
zone: "exodus.pp.ua/architecture"
order: 1
status: "active"
created: "2026-02-22"
updated: "2026-02-22"
---

# Architecture Guardian

## Зона відповідальності
exodus.pp.ua/architecture/**

## Поведінка (псевдокод)
```
ON new_note IN zone:
  READ existing notes IN zone
  CHECK consistency WITH КОНТРАКТ_АГЕНТА_V1
  IF gap FOUND:
    CREATE proposal IN inbox
  UPDATE КАРТА_ГРАФУ links

ON proposal APPROVED:
  WRITE updated note
  UPDATE cross-links
  COMMIT with message
```

## Тригери
- Нова нотатка в зоні
- Зміна існуючої нотатки
- Proposal approved

## Примітки
Відповідає за узгодженість архітектурної документації.
```

### Новий файл: `src/types/agentRegistry.ts`

```typescript
export type AgentStatus = 'active' | 'inactive' | 'draft';

export interface AgentDefinition {
  id: string;
  name: string;
  zone: string;           // folder path, e.g. "exodus.pp.ua/architecture"
  order: number;          // execution sequence (1 = first)
  status: AgentStatus;
  behavior: string;       // pseudocode / behavior description (markdown)
  description?: string;   // short one-liner
  triggers?: string[];    // what activates this agent
  created: string;        // ISO date
  updated: string;        // ISO date
}
```

### API client (додати в `src/lib/api/mcpGatewayClient.ts`)

Агенти зберігаються як markdown-файли в репо. Для читання/запису використовуй існуючий `NoteEditor` або прямі API ендпоінти якщо вони є. Якщо немає файлового API — зберігай агентів в `localStorage` під ключем `agent-registry` як JSON array. При наступному git push вони потраплять в репо.

### Нова сторінка: `src/pages/AgentsPage.tsx`

Роут: `/agents` — доступний тільки для власника (`isAuthenticated`).

Структура сторінки:
```
[+ New Agent]                          [breadcrumb: Home > Agents]

┌─────────────────────────────────────────────────────┐
│ #1  Architecture Guardian    exodus.pp.ua/architecture  ● active  [↑][↓][Edit][Delete] │
│ #2  Operations Keeper        exodus.pp.ua/operations    ● active  [↑][↓][Edit][Delete] │
│ #3  Frontend Sync            exodus.pp.ua/frontend      ○ draft   [↑][↓][Edit][Delete] │
└─────────────────────────────────────────────────────┘
```

Кожен рядок — компонент `AgentCard`:
- Порядковий номер (#1, #2...)
- Назва + коротка зона
- Статус badge (active = зелений, inactive = сірий, draft = жовтий)
- Кнопки ↑/↓ (reorder, swap order numbers)
- Edit → відкриває форму
- Delete → підтвердження

### Форма AgentForm (Sheet або Modal)

Поля:
| Поле | Тип | Опис |
|------|-----|------|
| `name` | text (required) | Назва агента |
| `id` | text (auto-generated з name, можна редагувати) | kebab-case |
| `zone` | text (required) | Шлях до папки, напр. `exodus.pp.ua/architecture` |
| `order` | number (auto: max+1) | Порядок виконання |
| `status` | select: active / inactive / draft | Поточний стан |
| `description` | text (короткий однорядковий опис) | |
| `behavior` | textarea (великий, ~15 рядків) | Псевдокод поведінки |

Зона `zone` — select або text з autocomplete на основі існуючих папок:
```
exodus.pp.ua/architecture
exodus.pp.ua/architecture/core
exodus.pp.ua/architecture/features
exodus.pp.ua/architecture/governance
exodus.pp.ua/backend
exodus.pp.ua/drakon
exodus.pp.ua/frontend
exodus.pp.ua/manifesto
exodus.pp.ua/operations
exodus.pp.ua/product
```

Validation (Zod):
- `name` — min 3 chars
- `id` — kebab-case, no spaces, unique
- `zone` — non-empty
- `behavior` — min 20 chars

### Ліва панель: деталі агента

При кліку на AgentCard (не Edit) — показати деталі в правому side panel або expandable row:
- Повний текст `behavior` в code block (monospace font, без виконання)
- `triggers` список
- `created` / `updated` дати

### Роут і навігація

Додай `/agents` в `src/App.tsx`.
Додай посилання в `OwnerMenu.tsx` (поряд з іншими owner-only пунктами).

---

## TASK B — Documentation Audit & Navigation

Прочитай ВСІ 62 файли в `docs/` (рекурсивно).

### B1: Покращити docs/ІНДЕКС.md

Поточний ІНДЕКС.md — оновити:
- Перевірити що всі файли в docs/ присутні в індексі
- Додати відсутні (memory/*, agents/* після Task A)
- Структурувати за доменами з коротким описом кожного файлу (1 рядок)
- Зберегти wiki-links формат `[[шлях/до/файлу]]`

### B2: README для кожної папки

Для кожної підпапки docs/ без README або ІНДЕКСУ — створити `_INDEX.md`:

```markdown
# {Folder Name}

Короткий опис що тут зберігається (1-2 речення).

## Файли

| Файл | Опис | Статус |
|------|------|--------|
| [[назва]] | одна фраза | canonical / draft / historical |
```

Папки без індексу: `architecture/core/`, `architecture/features/`, `architecture/governance/`, `architecture/non-functional/`, `backend/`, `drakon/`, `frontend/`, `manifesto/`, `operations/`, `product/`.

**НЕ чіпати** `docs/memory/` — там вже є README.md.

### B3: Оновити crosslinks

Пройди кожен файл в `docs/architecture/core/` та `docs/operations/`:
- Переконайся що взаємопов'язані документи мають wiki-links один на одного
- Якщо КОНТРАКТ_АГЕНТА_V1 згадує КОНВЕЄР_ВИКОНАННЯ — перевір чи є `[[КАНОНІЧНИЙ_КОНВЕЄР_ВИКОНАННЯ]]`
- Додай відсутні посилання в кінець файлу під заголовком `## Пов'язані документи`

**Правило:** додавай посилання тільки якщо документ реально пов'язаний за змістом. Не додавай для повноти.

### B4: Маркування застарілих

Файли в `docs/architecture/historical/`:
- `АРХІТЕКТУРНА_БАЗА_СИСТЕМИ.md`
- `АРХІТЕКТУРНИЙ_АУДИТ_ТА_УЗГОДЖЕНІСТЬ_ФІНАЛЬНИЙ.md`

Якщо ці файли не мають frontmatter `status: historical` — додай в початок:
```markdown
> **Статус: HISTORICAL** — цей документ є архівним. Актуальна версія: [[АРХІТЕКТУРНИЙ_КОРІНЬ]] або [[КАНОНІЧНА_АРХІТЕКТУРА_ВИКОНАННЯ]].
```

### B5: docs/agents/ початковий стан

Після Task A — створити `docs/agents/README.md`:

```markdown
# Agent Registry

Визначення агентів системи Garden Bloom.

Кожен агент — окремий .md файл з frontmatter та описом поведінки.
Управляється через UI: /agents (owner only).

## Структура

| Поле | Тип | Опис |
|------|-----|------|
| id | string | Унікальний kebab-case ідентифікатор |
| name | string | Назва агента |
| zone | string | Делегована папка в knowledge base |
| order | number | Порядок виконання в pipeline |
| status | active/inactive/draft | Поточний стан |
| behavior | markdown | Псевдокод поведінки |
```

---

## Commits

Для Task A:
```
feat: add Agent Registry UI — declare agents with delegated zones
feat: add /agents route and OwnerMenu link
feat: add AgentDefinition type and persistence
```

Для Task B:
```
docs: add folder index files for all docs/ subdirectories
docs: update crosslinks in architecture/core and operations
docs: mark historical documents with status banners
docs: create docs/agents/ directory with README
```

---

## Обмеження

- ❌ НЕ чіпай `src/site/notes/violin.pp.ua/` — це окремий проект
- ❌ НЕ змінюй `docs/memory/` — там окрема підсистема
- ❌ НЕ виконуй агентів — лише CRUD їх визначень
- ✅ `docs/` і `src/site/notes/exodus.pp.ua/` — синхронні дзеркала. Якщо змінюєш файл в docs/ — той самий файл є в src/site/notes/exodus.pp.ua/ з тим самим відносним шляхом. Зміни потрібні в ОБОХ місцях.
