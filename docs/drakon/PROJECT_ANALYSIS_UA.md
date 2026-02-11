# PROJECT_ANALYSIS_UA — Технічний аналіз Garden Bloom

**Дата:** 2026-02-07
**Автор:** Claude CLI дослідницький агент
**Проєкт:** garden-bloom (https://github.com/maxfraieho/garden-bloom)

---

## 1. Загальний опис

**Garden Bloom** — це Digital Garden (цифровий сад) — веб-додаток для публікації, редагування та перегляду markdown-нотаток з вікілінками, графом знань, системою тегів, зонами доступу та мультимовною підтримкою.

Додаток розгорнуто через Lovable.dev з ручною інспекцією коду через Claude Code.

---

## 2. Технологічний стек

| Категорія | Технологія | Версія |
|-----------|-----------|--------|
| **Frontend Framework** | React | 18.3.1 |
| **Build Tool** | Vite | 5.4.19 |
| **Мова** | TypeScript | 5.8.3 |
| **CSS Framework** | Tailwind CSS | 3.4.17 |
| **UI бібліотека** | shadcn-ui (Radix UI) | множинні @radix-ui пакети |
| **State Management** | TanStack Query (React Query) | 5.83.0 |
| **Routing** | React Router DOM | 6.30.1 |
| **Форми** | React Hook Form + Zod | 7.61.1 / 3.25.76 |
| **Markdown** | react-markdown + remark-gfm | 10.1.0 / 4.0.1 |
| **Іконки** | Lucide React | 0.462.0 |
| **Графіки** | Recharts | 2.15.4 |
| **Теми** | next-themes | 0.3.0 |
| **Сповіщення** | Sonner | 1.7.4 |
| **Лінтинг** | ESLint | 9.32.0 |
| **Dev** | lovable-tagger | 1.1.13 |

### Важливі спостереження
- **Немає серверного бекенду** у репозиторії — фронтенд-only SPA
- **Cloudflare Worker** для оркестрації (`infrastructure/cloudflare/worker/`)
- **n8n Migration** інфраструктура для API gateway (`infrastructure/n8n-migration/`)
- **Немає тестів** — відсутній vitest/jest у devDependencies

---

## 3. Структура проєкту

```
garden-bloom/
├── .claude/                  # Claude Code конфігурація (SKILLS, COMMANDS)
├── .github/workflows/        # CI/CD (deploy-worker, mirror)
├── agents/                   # Промпти для різних AI агентів
│   ├── chatgpt/
│   ├── claude-cli/
│   ├── comet/
│   ├── lovable/
│   ├── replit/
│   └── research/
├── add_editor/               # Додатковий HTML-редактор
├── apps/web/                 # Субпроєкт (web)
├── cloud-cli/                # Діагностика access-zone
├── docs/                     # Архітектурна документація
│   ├── access-model.md
│   ├── architecture.md
│   ├── security.md
│   └── ai-agent-system/      # 8 документів по AI-агентній системі
├── infrastructure/            # Серверна інфраструктура
│   ├── cloudflare/worker/     # Cloudflare Worker (auth, access zones)
│   └── n8n-migration/         # Redis, Docker, API adapter
├── public/                    # Статичні файли
├── src/                       # ОСНОВНИЙ КОД
│   ├── App.tsx                # Головний компонент
│   ├── main.tsx               # Entry point
│   ├── components/
│   │   ├── AccessGateUI.tsx   # Логін-gate
│   │   ├── AccessGuard.tsx    # Route-guard
│   │   ├── garden/            # ~40+ компонентів (основний UI)
│   │   ├── notebooklm/       # NotebookLM інтеграція
│   │   ├── theme-provider.tsx
│   │   ├── ui/                # shadcn-ui (~50 компонентів)
│   │   └── zones/             # Зони доступу (consent gate, etc.)
│   ├── hooks/                 # ~18 кастомних хуків
│   ├── lib/
│   │   ├── api/               # MCP Gateway client
│   │   ├── chat/              # Chat types
│   │   ├── comments/          # Comment types
│   │   ├── export/            # Export formatters
│   │   ├── i18n/              # Інтернаціоналізація (5 мов)
│   │   ├── notes/             # Note loader, link graph, search
│   │   └── utils.ts           # cn() та інші утиліти
│   ├── pages/                 # 14 сторінок
│   ├── site/                  # Контент (markdown нотатки + зображення)
│   └── types/                 # TypeScript типи
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── eslint.config.js
```

---

## 4. Markdown-рендеринг (КРИТИЧНО для інтеграції DRAKON)

### Поточна реалізація: `src/components/garden/NoteRenderer.tsx`

- Використовує `react-markdown` v10.1.0 з плагіном `remark-gfm`
- **Кастомний рендеринг**: custom `components` для `p`, `li`, `strong`, `em`, `h1-h3`
- **Wikilink система**: `[[target|alias]]` → трансформується в маркери `%%WIKILINK:slug:text:exists%%` → парситься в React `<WikiLink>` компоненти
- **Search highlighting**: Підсвітка пошукових збігів у тексті
- **Клас**: `prose-garden` (кастомний Tailwind prose)

### Точки розширення для DRAKON
1. **Custom code block renderer** — можна додати обробку `:::drakon` або ` ```drakon ` блоків
2. **Custom components** в react-markdown — додати нові типи блоків
3. **Remark plugin** — створити remark-drakon для парсингу спеціальних блоків

### Другий рендерер: `src/components/garden/ZoneNoteRenderer.tsx`
- Аналогічний NoteRenderer, але для зон доступу

---

## 5. Система i18n

### Реалізація: `src/lib/i18n/` + `src/hooks/useLocale.tsx`

- **5 мов**: uk (українська, default), en, fr, de, it
- **Кастомна реалізація** — без i18next, просто TypeScript об'єкти
- **Тип**: `Translations` з повним деревом ключів
- **Provider**: `LocaleProvider` → `useLocale()` хук
- Для DRAKON потрібно буде додати ключі у всі 5 файлів локалізації

---

## 6. Система зон доступу / Consent Gating

### Архітектура

1. **OwnerAuth** (`src/hooks/useOwnerAuth.tsx`)
   - Master password аутентифікація
   - OwnerSetupWizard для першого налаштування
   - OwnerAuthProvider context

2. **AccessGuard** (`src/components/AccessGuard.tsx`)
   - Route-level guard для всіх маршрутів
   - Zone routes (`/zone/*`) виключені — мають власну валідацію
   - Перевіряє: isAuthenticated, gatewayAvailable

3. **ZoneConsentGate** (`src/components/zones/ZoneConsentGate.tsx`)
   - GDPR-подібний consent flow
   - localStorage для збереження consent
   - Policy versioning
   - Checkbox + підтвердження

4. **Access Zones** система:
   - `useAccessZones.ts` — хук для управління зонами
   - `AccessZonesManager.tsx` — UI для створення зон
   - `AccessZonesWall.tsx` — стіна зон
   - `ZoneViewPage.tsx` / `ZoneEditPage.tsx` — сторінки зон
   - QR-код доступу (`ZoneQRDialog.tsx`)

---

## 7. Routing

```
/                            → Index (домашня)
/notes/:slug                 → NotePage (перегляд нотатки)
/notes/:slug/edit            → EditorPage (редагування)
/notes/new                   → EditorPage (нова нотатка)
/tags                        → TagsIndex
/tags/:tag                   → TagPage
/graph                       → GraphPage (граф знань)
/files                       → FilesPage
/zone/:zoneId                → ZoneViewPage
/zone/:zoneId/edit/:noteSlug → ZoneEditPage
/chat                        → ChatPage
/admin/diagnostics           → AdminDiagnosticsPage
/admin/zones                 → AdminZonesPage
/admin/settings              → AdminSettingsPage
/policy/delegated-zone-confidentiality → PolicyPage
*                            → NotFound
```

---

## 8. Provider Stack (App.tsx)

```
QueryClientProvider
  └─ ThemeProvider (next-themes)
      └─ LocaleProvider (i18n)
          └─ OwnerAuthProvider (auth)
              └─ TooltipProvider
                  ├─ Toaster
                  ├─ Sonner
                  └─ AppContent
                      └─ BrowserRouter
                          └─ AccessGuard
                              └─ SearchHighlightProvider
                                  └─ Routes
```

---

## 9. Build System

- **Vite 5.4.19** з `@vitejs/plugin-react-swc`
- **Alias**: `@` → `./src`
- **Port**: 8080
- **Mode-specific**: lovable-tagger лише в development
- **PostCSS**: autoprefixer + Tailwind
- **TypeScript**: strict mode, ESM (`"type": "module"`)

---

## 10. Ключові спостереження для інтеграції

| Аспект | Стан | Вплив на інтеграцію |
|--------|------|---------------------|
| react-markdown | Вже використовується | Можна розширити custom components |
| TypeScript strict | Так | Потрібні повні типи для DRAKON adapter |
| shadcn-ui | Основна UI бібліотека | Нові компоненти мають слідувати стилю |
| Tailwind | Utility-first | CSS ізоляція DRAKON через scoped styles |
| Lazy loading | Частково (потрібно додати) | DRAKON — ідеальний кандидат для lazy |
| Тести | Відсутні | Немає constraint, але варто додати |
| ESM | Так | DRAKON widget — UMD, потрібен адаптер |
| SSR | Ні (SPA) | Спрощує client-only mount DRAKON |

---

## 11. Висновок

Garden Bloom — це зрілий React SPA з добре організованою архітектурою, розвиненою системою зон доступу та markdown-рендерингу. Проєкт створений та підтримується через Lovable.dev з Claude Code як інспектором.

**Головні точки інтеграції DRAKON:**
1. `NoteRenderer.tsx` — розширення markdown-рендерера
2. `src/components/garden/` — нові компоненти для DRAKON
3. `src/hooks/` — хук для управління діаграмами
4. `src/lib/i18n/locales/` — переклади для DRAKON UI
5. `src/lib/notes/types.ts` — типи для діаграм у нотатках
