# 🌱 Digital Garden (Sweet Brain Share Hub) — AGENT HANDOFF

> Цей документ — «передача зміни» для наступного Lovable агента/акаунта.
> Мета: швидко відновити контекст, зрозуміти актуальний стан, не зламати інтеграції, та продовжити розробку.

**Останнє оновлення:** 2026-01-28

---

## 0) TL;DR (що це за проєкт)

Це **Digital Garden** (веб-застосунок на Lovable/React) для перегляду та навігації по markdown-нотатках з:

- wiki-посиланнями (`[[...]]`), тегами, пошуком, графами звʼязків;
- **Owner Mode** (власник/адмін): логін, налаштування, керування зонами доступу;
- **Access Zones**: гостьовий/делегований доступ до підмножини нотаток по коду + строк дії;
- інтеграціями через **Cloudflare Worker gateway** (зовнішній бекенд): auth/zones/sessions/MCP;
- окремою фічею **NotebookLM Chat** (через worker → Replit backend), з діагностикою в адмінці.

Проєкт дотримується підходу **Agentic Triad Pipeline**:
- *Lovable* — фронтенд/UI інтеграція
- *Comet* — інфра/деплой (Cloudflare Worker, n8n і т.д.)
- *Claude/Replit* — бекенд/автоматизація/безпека (у межах того, що живе поза Lovable)

---

## 1) Архітектура (актуальна)

### Frontend (цей репозиторій, Lovable)
- **React 18 + Vite + TypeScript + Tailwind + shadcn/ui**
- **React Router**: `src/App.tsx`
- **React Query** для серверного стану
- Контент — markdown файли під `src/site/notes/**`

### Backend gateway (поза Lovable)
**Cloudflare Worker** — єдиний «вхід» для фронтенда:
- Owner Auth (setup/login/validate/refresh)
- Access Zones (create/list/validate/notes)
- MCP sessions (create/list/revoke) + JSON-RPC + SSE
- NotebookLM proxy (`/notebooklm/*`) до Replit backend

### NotebookLM backend (поза Lovable)
FastAPI сервіс на Replit (прокситься через worker):
- base URL (див. Memory): `https://notebooklm-gateway.replit.app`

---

## 2) Важливі URL та маршрути

### App URLs
- Preview: `https://id-preview--74acbf87-8cbe-4642-9ee8-ea1d18869969.lovable.app`
- Published: `https://sweet-brain-share-hub.lovable.app`

### Gateway URLs (Cloudflare Worker)
**Основний (CNAME):** `https://garden-mcp.exodus.pp.ua`

**Fallback (workers.dev):** `https://garden-mcp-server.maxfraieho.workers.dev`

### Важливі сторінки фронтенду
- `/` — головна сторінка garden
- `/notes/:slug` — нотатка
- `/tags` та `/tags/:tag`
- `/graph`
- `/files`
- `/zone/:zoneId` — гостьовий перегляд зони
- `/chat` — Chat UI (в т.ч. NotebookLM)
- `/admin/diagnostics` — адмін-діагностика (включно з тестом NotebookLM)

---

## 3) ENV/Secrets (критично при переносі між акаунтами)

### Frontend (.env у Lovable settings)
Мінімум:

```env
VITE_MCP_GATEWAY_URL=https://garden-mcp.exodus.pp.ua
```

> Якщо є проблеми з DNS/CNAME — тимчасово ставити fallback URL на workers.dev.

### Cloudflare Worker (Variables/Secrets в Cloudflare Dashboard)
Обовʼязкові для роботи MCP/Storage (як було раніше):
- `JWT_SECRET`
- `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- KV binding: `KV` (namespace для сесій/метаданих)

Для **NotebookLM Chat** (актуально зараз):
- `NOTEBOOKLM_BASE_URL` → `https://notebooklm-gateway.replit.app`
- `NOTEBOOKLM_SERVICE_TOKEN` → секрет, який Replit backend очікує як Bearer

> ВАЖЛИВО: після зміни secrets у Cloudflare Worker — зробити **Deploy/Redeploy**, інакше зміни можуть не застосуватися.

---

## 4) Ключові модулі/файли у фронтенді (де що шукати)

### Роутинг/Providers
- `src/App.tsx`

### Owner Auth
- `src/hooks/useOwnerAuth.tsx`
- UI:
  - `src/components/garden/OwnerSetupWizard.tsx`
  - `src/components/garden/OwnerLoginDialog.tsx`
  - `src/components/garden/OwnerModeIndicator.tsx`
  - `src/components/garden/OwnerSettingsDialog.tsx`

### Access Zones
- `src/hooks/useAccessZones.ts`
- UI:
  - `src/components/garden/AccessZonesManager.tsx`
  - `src/components/garden/ZoneCreationDialog.tsx`
  - `src/components/garden/ZoneQRDialog.tsx`
  - `src/components/garden/AccessZonesWall.tsx`

### NotebookLM
- UI:
  - `src/components/notebooklm/*`
  - `src/components/zones/NotebookLMStatusBadge.tsx`
- API client:
  - `src/lib/api/mcpGatewayClient.ts`

### Нотатки/рендеринг
- Loader: `src/lib/notes/noteLoader.ts`
- Parser: `src/lib/notes/wikilinkParser.ts`
- UI: `src/components/garden/NoteRenderer.tsx`, `WikiLink.tsx`, `BacklinksSection.tsx`

### Локалізація
- `src/lib/i18n/*` та `src/hooks/useLocale.tsx`

---

## 5) Поточний стан (що працює / що важливо перевірити після переносу)

### ✅ Працює/є в наявності
- Основний перегляд нотаток, теги, графи, пошук
- Owner initialization/login flow (через worker)
- CRUD для Access Zones (через worker)
- MCP sessions інтеграція
- NotebookLM Chat інтеграція через gateway (worker → Replit)
- `/admin/diagnostics` має інструменти для швидкого дебагу (включно з тестом NotebookLM)

### 🔍 Перевірити відразу після переносу в інший Lovable акаунт
1) **ENV `VITE_MCP_GATEWAY_URL`** в новому Lovable проєкті
2) **CORS/origin allowlist** у worker (якщо він його перевіряє) — додати нові preview/published домени
3) **Owner auth status**: відкрий `/admin/diagnostics` і перевір `/auth/status`
4) **NotebookLM Test Chat** в `/admin/diagnostics`
   - якщо `NOT_AUTHENTICATED`: проблема на стороні Replit (немає/протермінований `storage_state.json` або не залогінений Google/NotebookLM)
   - якщо `401/403`: перевір `NOTEBOOKLM_SERVICE_TOKEN` в worker та відповідність очікуванням Replit

---

## 6) Відомі больові точки / типові фейли

### NotebookLM: `NOT_AUTHENTICATED`
Сигналізує, що Replit backend не має валідної авторизації до NotebookLM UI (Playwright/Google session).

Що робити:
- оновити/перегенерувати `storage_state.json` у Replit (ручний браузерний логін або процес, який ви там використовуєте)
- повторити тест через `/admin/diagnostics`

### Gateway: `gatewayAvailable=false` або помилки `/auth/status`
Зазвичай причина:
- неправильний `VITE_MCP_GATEWAY_URL`
- Cloudflare worker не деплоєний/зламаний
- CORS/origin restrictions

---

## 7) Перспективні напрями розвитку (найближчі та стратегічні)

### Найближчі (практичні)
1) **Уніфікована діагностика в UI**
   - стандартизувати показ помилок NotebookLM (401/403/NOT_AUTHENTICATED/timeout) + короткі CTA
2) **Полірування Zone experience**
   - чіткий “Zone-only” режим: навігація, пошук/теги тільки в межах зони, зрозумілий banner “You are in zone X”
3) **Покриття тестами критичних флоу**
   - хоча б smoke-тести (Vitest) для i18n, note parsing, link graph
4) **Performance для великих garden**
   - оптимізація індексів пошуку/тегів/графа на фронті, lazy-loading важких view

### Стратегічні (з roadmap AI Agent System)
1) **Task Queue API (через Worker)** + UI для створення задач
2) **Agent roles (Archivist/Tech Writer/Architect)** з pipeline та approvals
3) **Збереження результатів агентів як draft-notes** в garden

---

## 8) Мінімальний чеклист для нового агента перед будь-якими змінами

1) Перевірити, що app відкривається без runtime errors
2) Відкрити `/admin/diagnostics` → пройтись по ключових checks
3) Перевірити, що зміна UI не ламає access model (Owner vs Zone vs Public)
4) Якщо торкаємось текстів — оновити всі локалі (uk/en/fr/de/it)

