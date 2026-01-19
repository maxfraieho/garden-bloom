# 🌱 Digital Garden — Agent Handoff Instructions

> Інструкція для Lovable агента для продовження розробки проекту

## ✅ Статус виправлень (2026-01-18)

### Виправлено
- ✅ Rollback коміту `1882c3f8` ("Migrate MCP gateway to Replit") — URL повернуто до Cloudflare Worker
- ✅ `gatewayAvailable: boolean` додано до `OwnerAuthState` interface
- ✅ Worker доступний і відповідає правильно (`/auth/status` → `initialized: true`)

### 🔍 Перевірити при наступному сеансі

1. **OwnerModeIndicator** — чи показується кнопка "Owner Login" в header?
2. **AccessGateUI** — цей компонент НЕ інтегрований в `Index.tsx` (можливо так і задумано?)
3. **OwnerSetupWizard** — чи показується при першому запуску (якщо `initialized: false`)?

### 📁 Файли для першочергового перегляду

```
КРИТИЧНІ (auth/access):
1. src/hooks/useOwnerAuth.tsx         # Auth hook - gatewayAvailable тепер boolean
2. src/components/garden/OwnerModeIndicator.tsx  # Admin menu в header
3. src/components/garden/GardenHeader.tsx  # Header з OwnerModeIndicator

ЯКЩО потрібен access gate:
4. src/components/AccessGateUI.tsx    # Форма входу за кодом (не інтегрована!)
5. src/components/AccessGuard.tsx     # Guard wrapper
6. src/pages/Index.tsx                # Головна сторінка
```

---

## 📋 Крок 1: Ознайомлення з проектом

Прочитай ці ключові файли для розуміння архітектури:

```
Прочитай файли:
- src/App.tsx (головний роутинг та providers)
- src/hooks/useOwnerAuth.tsx (система автентифікації власника)
- src/hooks/useAccessZones.ts (управління делегованим доступом)
- src/lib/notes/noteLoader.ts (завантаження markdown нотаток)
- src/lib/i18n/types.ts (структура локалізації)
```

## 🏗️ Архітектура проекту

### Технологічний стек
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **UI**: shadcn/ui компоненти
- **Routing**: React Router DOM
- **State**: React Query + Custom Hooks
- **Backend**: Cloudflare Worker (зовнішній, не в Lovable)

### Структура папок
```
src/
├── components/garden/    # Основні UI компоненти
├── hooks/                # Custom React hooks
├── lib/
│   ├── i18n/            # Локалізація (uk, en, fr, de, it)
│   ├── notes/           # Логіка роботи з нотатками
│   └── export/          # Експорт для AI контексту
├── pages/               # Сторінки роутингу
└── site/notes/          # Markdown нотатки (контент)
```

## 🔐 Система автентифікації

### MCP Gateway URL
**ВАЖЛИВО**: Правильний URL для Cloudflare Worker:
```
https://garden-mcp.exodus.pp.ua
```

Альтернативний (якщо CNAME не працює):
```
https://garden-mcp-server.maxfraieho.workers.dev
```

### Owner Mode (Режим власника)
- **Hook**: `useOwnerAuth.tsx` — керує станом автентифікації
- **Backend**: Cloudflare Worker
- **Endpoints**: `/auth/status`, `/auth/setup`, `/auth/login`, `/auth/validate`, `/auth/logout`
- **UI компоненти**:
  - `OwnerSetupWizard.tsx` — перший запуск (налаштування пароля)
  - `OwnerLoginDialog.tsx` — вхід власника
  - `OwnerModeIndicator.tsx` — індикатор в хедері
  - `OwnerSettingsDialog.tsx` — налаштування (зміна пароля)

### Access Zones (Делегований доступ)
- **Hook**: `useAccessZones.ts` — CRUD для зон доступу
- **Концепція**: Власник створює тимчасові зони з обмеженим доступом до папок
- **Типи доступу**: `web` | `mcp` | `both`
- **UI компоненти**:
  - `ZoneCreationDialog.tsx` — створення нової зони
  - `AccessZonesManager.tsx` — список активних зон
  - `ZoneQRDialog.tsx` — QR-код для швидкого доступу

## 📝 Система нотаток

### Завантаження контенту
- `noteLoader.ts` — динамічний імпорт `.md` файлів з `src/site/notes/`
- Підтримка YAML frontmatter
- Wikilinks: `[[назва нотатки]]`
- Теги: `#tag1 #tag2`

### Ключові компоненти
- `NoteRenderer.tsx` — рендеринг markdown з підтримкою wikilinks
- `WikiLink.tsx` — інтерактивні посилання між нотатками
- `BacklinksSection.tsx` — зворотні посилання
- `LocalGraphView.tsx` / `GlobalGraphView.tsx` — візуалізація зв'язків

## 🌍 Локалізація

### Підтримувані мови
- Українська (uk) — основна
- English (en)
- Français (fr)
- Deutsch (de)
- Italiano (it)

### Файли
- `src/lib/i18n/types.ts` — TypeScript інтерфейси
- `src/lib/i18n/locales/*.ts` — переклади
- `useLocale.tsx` — hook для використання

### ⚠️ При додаванні нових рядків
Завжди оновлюй ВСІ 5 файлів локалізації!

## 🔄 Поточний стан розробки

### ✅ Завершено
1. **Owner Authentication** — повний цикл (setup → login → validate → logout)
2. **Access Zones UI** — створення, перегляд, відкликання зон
3. **QR Code генерація** — для швидкого доступу до зон
4. **MCP Sessions** — інтегровано в `/sessions/create` endpoint
5. **Export Context** — експорт нотаток для AI (JSON, Markdown, JSONL)
6. **Локалізація** — повна підтримка 5 мов
7. **AccessZonesManager в OwnerSettingsDialog** — ✅ інтегровано як вкладка

### 🚧 В процесі / Наступні кроки
1. ⚠️ **Виправити auth UI** — `OwnerModeIndicator` та `AccessGateUI` не відображаються
2. ⚠️ **Worker v2.0 deploy** — потребує оновлення (див. `garden-mcp-worker-auth.md`)
3. **Zone View Mode** — режим перегляду для гостей з обмеженим контентом

## 🔧 Cloudflare Worker

### Документація коду
Повний код Worker v2.0 з інструкціями розгортання для Comet агента:
```
src/site/notes/exodus.pp.ua/Сервіси/MCP/Конфігурації/garden-mcp-worker-auth.md
```

### KV Namespaces
- `garden-mcp-kv` — MCP сесії та snapshots
- `garden-auth-kv` — автентифікація власника

### Ключові endpoints
- `/auth/*` — owner authentication
- `/sessions/create` — створення MCP сесії з notes snapshot
- `/sessions/revoke` — видалення сесії
- `/mcp/{sessionId}` — отримання snapshot (JSON)
- `/mcp/{sessionId}?format=markdown` — Markdown формат
- `/mcp/{sessionId}?format=jsonl` — JSONL формат
- `/health` — health check з версією

## 📌 Важливі ENV змінні

```env
VITE_MCP_GATEWAY_URL=https://garden-mcp.exodus.pp.ua
```

## 🎯 Пріоритетні задачі для продовження

1. **🔴 Виправити UI auth** — OwnerModeIndicator та AccessGateUI не рендеряться
2. **Deploy Worker v2.0** — скопіюй код з `garden-mcp-worker-auth.md` в Cloudflare Dashboard
3. **Створи Zone View** — сторінка `/zone/:zoneId` для гостьового доступу
4. **Тестування** — перевір повний flow: створення сесії → доступ до snapshot → expiration

## 🗺️ План розвитку (Roadmap)

Детальний roadmap з фазами та термінами:
```
docs/ai-agent-system/06-roadmap.md
```

### Phase 1: MVP (4 тижні)
- Task Queue API (Worker)
- Archivist role (summarize)
- RPi polling daemon
- Basic UI for task creation

### Phase 2: Extended Roles
- Technical Writer, Architect roles
- Proposal system

### Phase 3: Cloud Integration
- Replit backend (FastAPI + LanceDB)
- Advanced vector search

## 💡 Поради для агента

1. **Читай контекст** — Memory в `<useful-context>` містить важливу інформацію
2. **Паралельні виклики** — завжди роби кілька read/write одночасно
3. **Локалізація** — не забувай про всі 5 мов при зміні тексту
4. **Semantic tokens** — використовуй кольори з design system, не hardcode
5. **Маленькі компоненти** — краще багато малих файлів ніж один великий

## 🐛 Debugging Tips

### Якщо admin menu не показується:
1. Перевір console на помилки `useOwnerAuth`
2. Перевір network request до `/auth/status`
3. Переконайся що `gatewayAvailable` = true в state
4. Перевір що `OwnerModeIndicator` є в `GardenHeader`

### Якщо форма входу не показується:
1. Перевір `AccessGateUI` рендеринг в `Index.tsx`
2. Перевір умови показу (зазвичай залежить від route)

---

*Останнє оновлення: 2026-01-18*
*Версія проекту: Digital Garden with Owner Auth & MCP Sessions v2.0*
*Статус: 🔴 Auth UI не працює після rollback*
