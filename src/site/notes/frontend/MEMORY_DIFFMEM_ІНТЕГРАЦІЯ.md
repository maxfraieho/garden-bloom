---
tags:
  - domain:frontend
  - domain:memory
  - status:deprecated
  - format:specification
created: 2026-03-08
updated: 2026-03-08
tier: 2
title: "Memory / DiffMem — Frontend Integration"
dg-publish: true
deprecated_by: "frontend/ПАМ_ЯТЬ_DIFFMEM_ІНТЕГРАЦІЯ.md"
---

> ⚠️ DEPRECATED. Канонічна версія: [[ПАМ_ЯТЬ_DIFFMEM_ІНТЕГРАЦІЯ]]. Цей документ є застарілою EN-копією.


# Memory / DiffMem — Frontend Integration

> Створено: 2026-03-08
> Статус: canonical
> Мова: Українська (канонічна)
> Цей документ є специфікацією frontend-інтеграції Memory API.
> Цей документ залежить від: `backend/КОНТРАКТИ_API_V1.md`, `architecture/runtime/BLOOM_MEMORY_ARCHITECTURE.md`
> Від цього документа залежать: компоненти `MemoryPanel`, `src/components/memory/*`, хук `useAgentMemory`

---

## 1. Огляд

Frontend надає UI для роботи з Agent Memory — git-backed системою пам'яті агентів на основі DiffMem-архітектури. Ключовий інваріант: **поточний стан (current-state) і історія (temporal layer) — це дві окремі поверхні**, які не змішуються.

### Компоненти

| Компонент | Файл | Призначення |
|-----------|------|-------------|
| `MemoryPanel` | `src/components/garden/MemoryPanel.tsx` | Головна Sheet-панель з вкладками Search / Context / Add |
| `DepthSwitcher` | `src/components/memory/DepthSwitcher.tsx` | Перемикач depth modes |
| `HistoryPanel` | `src/components/memory/HistoryPanel.tsx` | Список комітів entity |
| `DiffViewer` | `src/components/memory/DiffViewer.tsx` | Перегляд diff між ревізіями |
| `RevisionSnapshotViewer` | `src/components/memory/RevisionSnapshotViewer.tsx` | Read-only перегляд historical snapshot |
| `TemporalAttachments` | `src/components/memory/TemporalAttachments.tsx` | Temporal-специфічні вкладення |
| `WriterStatusBanner` | `src/components/memory/WriterStatusBanner.tsx` | Статус writer staging flow |

### Хуки та клієнт

| Модуль | Файл | Призначення |
|--------|------|-------------|
| `useAgentMemory` | `src/hooks/useAgentMemory.ts` | React-хук для всіх Memory API операцій |
| API клієнт | `src/lib/api/mcpGatewayClient.ts` | HTTP-функції для Memory endpoints |
| Типи | `src/types/agentMemory.ts` | TypeScript інтерфейси для Memory API |

---

## 2. Depth Modes

Frontend підтримує 4 режими глибини контексту:

### 2.1 `surface` — поверхневий

- Повертає top-ranked entities з обрізаним контентом (~500 символів)
- Найшвидший режим
- UX-сенс: швидкий огляд, орієнтація

### 2.2 `wide` — широкий (default)

- BM25-пошук по запиту + ALWAYS_LOAD блоки
- Кілька entities, present-state only
- UX-сенс: дослідження теми, збір контексту

### 2.3 `deep` — глибокий

- Повний контент matched entities + глибокий graph traversal
- Present-state only (без історії)
- UX-сенс: детальне вивчення конкретної теми

### 2.4 `temporal` — часовий

- Як `deep`, але з додатковим temporal layer
- Відкриває доступ до `temporalAttachments` у відповіді
- Показує кнопку "історія" біля кожної entity
- UX-сенс: розуміння еволюції знань, аудит змін

**Важливо:** `temporal` — це **не** default режим. Surface/wide/deep працюють як current-state modes. Temporal відкриває history layer окремо і on-demand.

Перемикач реалізований у `DepthSwitcher`:

```
surface ← wide → deep → temporal
```

---

## 3. History Panel

### Як працює

1. Користувач обирає `depth=temporal` у Context tab
2. Біля кожної entity з'являється кнопка "історія"
3. Натиснення → `GET /v1/memory/entities/:id/history`
4. `HistoryPanel` рендерить список комітів

### Що відображається

| Поле | Джерело |
|------|---------|
| SHA коміту | `history[].sha` |
| Час | `history[].timestamp` |
| Повідомлення | `history[].message` |
| Автор | `history[].author` |

### Інваріанти

- History — **не** search result list. Це git commit log для конкретної entity.
- History показується тільки on-demand, не preload.
- З History можна відкрити diff або revision snapshot.

---

## 4. Diff Viewer

### Як відкривається

1. У `HistoryPanel` користувач обирає два коміти для порівняння
2. Або через `TemporalAttachments` натискає на diff link
3. Викликається `GET /v1/memory/entities/:id/diff?from=<sha>&to=<sha>`

### Що відображається

- Patch у unified diff форматі
- Кількість additions / deletions
- Entity ID і SHA ревізій

### Інваріанти

- Diff — **окрема temporal surface**. Patch не підмішується в current-state content.
- `DiffViewer` є read-only компонентом.

---

## 5. Revision Snapshot Viewer

### Що це

Read-only перегляд entity у конкретній historical ревізії.

### Як працює

1. З `HistoryPanel` або `TemporalAttachments` обирається SHA ревізії
2. `GET /v1/memory/entities/:id/revisions/:sha`
3. `RevisionSnapshotViewer` рендерить Markdown content

### Інваріанти

- Historical snapshot **не замінює** current-state entity view.
- UI чітко маркує це як минулий стан (SHA, timestamp).
- Snapshot — read-only, без редагування.

---

## 6. Temporal Attachments

### Що це

`temporalAttachments` — масив history entries, що повертається backend **тільки для `depth=temporal`**.

### Response shape

```typescript
interface TemporalAttachment {
  entityId: string;
  history: HistoryEntry[];  // SHA, timestamp, message, author
}
```

### Як відображаються

- `TemporalAttachments` компонент рендерить список entity → history entries
- З кожного запису можна відкрити revision snapshot або diff
- Компонент **не показується** для `surface`, `wide`, `deep` modes

### Відмінність від current-state sources

| | Current-state sources | Temporal attachments |
|---|---|---|
| Коли з'являються | Завжди (search/context) | Тільки `depth=temporal` |
| Що містять | Entity content, relevance | Git history entries |
| Дії | Expand entity | Open diff / revision |

---

## 7. Agent-Aware UI Flows

### 7.1 Factual Flow (Search tab)

1. Користувач вводить запит
2. `POST /v1/memory/:userId/orchestrated-search`
3. LLM генерує sub-queries, шукає, синтезує відповідь
4. UI показує answer + sources (present-state)
5. Кожне source можна розгорнути через `EntityViewer`

### 7.2 Temporal Flow (Context tab + temporal depth)

1. Обрати `depth=temporal`
2. Ввести контекстний запит
3. `POST /v1/memory/context` з `{ depth: "temporal" }`
4. Отримати `ContextGraph` з `temporalAttachments`
5. Відкрити history / diff / revision on-demand

### 7.3 Writer Flow (Add tab)

1. Користувач вставляє текст у textarea
2. `POST /v1/memory/:userId/process-transcript`
3. Backend обробляє текст, витягує entities
4. UI показує affected entities (created/updated)

### 7.4 Staging States

```
idle → staged → committing → committed
                    ↓
                  error
```

| Стан | Опис |
|------|------|
| `idle` | Немає активної сесії |
| `staged` | Зміни витягнуті, але не закомічені |
| `committing` | Виконується commit |
| `committed` | Зміни збережені в git |
| `error` | Помилка під час процесу |

**Інваріант:** staged state ≠ committed history. Staged зміни ще не є частиною git history і не видимі через temporal endpoints.

`WriterStatusBanner` — інтегровано у `AddMemoryTab` всередині `MemoryPanel`. Відображає реальний стан process-transcript flow: `idle` (приховано), `committing` (анімація), `committed` (з commitSha та кількістю entities), `error` (з повідомленням). Стан `staged` не використовується, бо `autoCommit=true` — окремого staging кроку немає.

---

## 8. Backend Contracts (Frontend-Facing)

Всі запити проходять через Cloudflare Worker proxy → Nginx → Memory API (:3001). Proxy route додано у Worker код, deployment підтверджено користувачем (runtime-верифікація через curl поки не виконана).

### 8.1 Endpoints

| Method | Endpoint | Опис |
|--------|----------|------|
| `GET` | `/v1/memory/search?q=&limit=` | BM25 present-state пошук |
| `POST` | `/v1/memory/context` | Context assembly з depth mode |
| `GET` | `/v1/memory/entities/:id` | Читання entity (present-state) |
| `GET` | `/v1/memory/entities/:id/history` | Git history entity |
| `GET` | `/v1/memory/entities/:id/diff?from=&to=` | Diff між ревізіями |
| `GET` | `/v1/memory/entities/:id/revisions/:sha` | Read-only historical snapshot |
| `POST` | `/v1/memory/:userId/process-transcript` | Обробка тексту в entities |
| `GET` | `/v1/memory/health` | Health check |
| `POST` | `/v1/memory/commit` | Commit staged changes |

### 8.2 Важливі уточнення

1. **`GET /v1/memory/entities/:id` повертає entity напряму**, не `{ entity }`. Frontend клієнт (`getMemoryEntity`) обробляє response як `MemoryEntity` без unwrap.

2. **Temporal endpoints не є search endpoints.** History, diff, revision — це git-based операції для конкретної entity, не пошукові результати.

3. **History layer не змішується з primary search.** Search працює по current-state BM25 індексу. History доступна тільки через temporal endpoints.

4. **Legacy route `/v1/memory/:userId/context` deprecated.** Frontend використовує `POST /v1/memory/context` (канонічний route). Legacy helper у `mcpGatewayClient.ts` редіректить на канонічний.

---

## 9. Infrastructure Dependencies

### Cloudflare Worker Proxy

Memory API вимагає, щоб Cloudflare Worker проксував `/v1/memory/*` маршрути на backend. Це критична передумова для роботи Memory панелі.

```
Frontend → CF Worker (/v1/memory/*) → Nginx → Memory API (:3001)
```

Без цього proxy всі Memory API виклики повертають 404.

Конфігурація: `_collab/infrastructure/cloudflare/worker/index.js`

### Auth

Worker передає `Authorization: Bearer <JWT>` header з owner session. Memory endpoints вимагають автентифікацію (крім `/v1/memory/health`).

---

## 10. Стан інтеграції

| Компонент | Статус |
|-----------|--------|
| Search tab (orchestrated) | ✅ Реалізовано |
| Context tab + depth switcher | ✅ Реалізовано |
| History panel | ✅ Реалізовано |
| Diff viewer | ✅ Реалізовано |
| Revision snapshot viewer | ✅ Реалізовано |
| Temporal attachments | ✅ Реалізовано |
| Writer flow (process-transcript) | ✅ Реалізовано |
| WriterStatusBanner | ✅ Інтегровано у AddMemoryTab (idle/committing/committed/error) |
| CF Worker proxy for /v1/memory/* | ⚠️ Код додано у Worker, deployed (user-reported, не runtime-verified автоматично) |
| Entity response shape alignment | ✅ Виправлено (direct, not wrapped) |
| Legacy route cleanup | ✅ Deprecated + redirected (internal compatibility helper) |

### TODO

- [x] ~~Інтегрувати `WriterStatusBanner` у Add tab writer flow~~ (done)
- [ ] Runtime-верифікація Memory endpoints через CF Worker (curl /v1/memory/health)
