# Lovable Prompt — Agent Memory Frontend v2

**Мета:** Покращити UX frontend-частини агентної системи пам'яті.

---

## Обов'язкове читання перед початком

Прочитай ці файли — вони дають повний контекст системи:

| Файл | Що описує |
|------|-----------|
| `docs/memory/IMPLEMENTATION_STATUS.md` | Поточний стан всіх 6 шарів, known gaps, архітектурні рішення |
| `docs/memory/ARCHITECTURE.md` | Схема системи, DiffMem концепція, 4-depth context model |
| `docs/memory/API_CONTRACT.md` | REST API spec: всі endpoints, request/response shapes |
| `docs/memory/BACKEND_STATUS.md` | Що реально живе на бекенді, протестовані endpoints |

---

## Що вже побудовано (НЕ перебудовувати)

- `src/hooks/useAgentMemory.ts` — хук: `search`, `getContext`, `processText`, `status`, `isLoading`, `error`, `refreshStatus`
- `src/components/garden/MemoryPanel.tsx` — Sheet sidebar, 3 вкладки: Search / Context / Add
- `src/components/garden/NoteLayout.tsx` — кнопка Memory в header (тільки для owner)
- `src/types/agentMemory.ts` — всі TypeScript типи
- `src/lib/api/mcpGatewayClient.ts` — всі API методи (рядки 900–1048)

---

## Task 1 — Виправити захардкоджений user ID (HIGH)

**Файл:** `src/components/garden/MemoryPanel.tsx`, рядок 12:
```typescript
const MEMORY_USER_ID = 'garden-owner';
```

Знайди як інші authenticated компоненти отримують поточного користувача (useAuth, currentUser, auth context — залежить від того що вже є в проекті). Використай той самий патерн.

Якщо `userId` null/undefined — показати замість вкладок:
```
<p>Sign in to use agent memory</p>
```

---

## Task 2 — Авто-виконання initialQuery (MEDIUM)

**Файл:** `src/components/garden/MemoryPanel.tsx`, компонент `SearchTab` (~рядок 100)

Зараз: `initialQuery` заповнює input, але треба натиснути кнопку вручну.

Потрібно: коли панель відкривається з `initialQuery` (наприклад, заголовок нотатки), пошук запускається автоматично.

Додай `useEffect` в `SearchTab`, який викликає `handleSearch()` при mount якщо `initialQuery` непорожній. Запускається тільки один раз.

---

## Task 3 — Markdown rendering у відповідях пошуку (MEDIUM)

**Файл:** `src/components/garden/MemoryPanel.tsx`, `SearchTab`, блок "Answer" (~рядок 157)

LLM-відповідь від `orchestrated-search` — це markdown, але рендериться як plain text.

Перевір чи є в проекті `react-markdown` або інший markdown renderer (`package.json`).
Якщо є — використай. Якщо ні — встанови `react-markdown`:

```typescript
import ReactMarkdown from 'react-markdown';

<ReactMarkdown className="prose prose-sm dark:prose-invert max-w-none text-sm">
  {result.answer}
</ReactMarkdown>
```

Те саме застосуй у `ContextTab` для рендерингу `result.context` (~рядок 244).

---

## Task 4 — Entity viewer (LOW-MEDIUM)

**Файл:** `src/components/garden/MemoryPanel.tsx`, список sources у `SearchTab` (~рядок 170+)

Зараз: sources показують `entityId` + score як статичний текст.

Потрібно: кожен source item отримує кнопку розгортання (іконка `ChevronDown`).
При кліку — fetch full entity:

```typescript
import { getMemoryEntity } from '@/lib/api/mcpGatewayClient';
// getMemoryEntity(userId, entityId) → Promise<MemoryEntity>
```

Показати вміст entity в expandable card під source item. Loading skeleton поки фетчиться. Контент рендерити тим самим markdown renderer що в Task 3.

Тип `MemoryEntity` є в `src/types/agentMemory.ts`.

---

## Task 5 — Виправити Session ID (LOW)

**Файл:** `src/hooks/useAgentMemory.ts`, ~рядок 117:

```typescript
// замінити:
const sessionId = `session-${Date.now()}`;

// на:
const sessionId = `session-${crypto.randomUUID()}`;
```

`crypto.randomUUID()` вбудований в браузер, жодних імпортів не потрібно.

---

## Commits (окремо для кожного task)

```
fix: resolve hardcoded MEMORY_USER_ID from auth context
feat: auto-execute memory search from note title on panel open
feat: render markdown in memory search answers and context
feat: entity content viewer in memory search results
fix: use crypto.randomUUID for session IDs
```

---

## Обмеження

- ❌ НЕ перебудовувати `MemoryPanel` з нуля — тільки модифікувати конкретні секції
- ❌ НЕ чіпати `mcpGatewayClient.ts` або `agentMemory.ts`
- ❌ НЕ змінювати логіку `useAgentMemory.ts` окрім Task 5
- ✅ Можна додавати нові sub-компоненти в той самий файл або в `src/components/garden/`
