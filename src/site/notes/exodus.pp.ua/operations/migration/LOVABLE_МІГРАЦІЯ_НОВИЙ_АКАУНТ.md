---
{"tags":["domain:operations","status:canonical","format:playbook"],"created":"2026-02-24","updated":"2026-02-24","title":"LOVABLE МІГРАЦІЯ НОВИЙ АКАУНТ","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/operations/migration/LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ/","dgPassFrontmatter":true,"noteIcon":""}
---

# Lovable: міграція на новий акаунт

> Чекліст для перенесення проєкту Garden Bloom на новий Lovable акаунт.

---

## 1. Перед стартом

Переконайся що маєш:

- [ ] Доступ до нового Lovable акаунту
- [ ] GitHub акаунт з доступом до репозиторію `maxfraieho/garden-seedling` (або форк)
- [ ] Значення `VITE_MCP_GATEWAY_URL` (Cloudflare Worker URL)
- [ ] Працюючий бекенд (Replit) та Worker — перевір `/health`

---

## 2. Створити проєкт у Lovable

1. У новому акаунті Lovable створи порожній React проєкт (назва: `Garden Bloom`)
2. Підключи GitHub: Settings → GitHub → підключити акаунт
3. Створи новий репозиторій або підключи існуючий
4. Скопіюй весь вміст з Git-репозиторію в новий (git clone → git push)
5. Переконайся що Lovable підхопив код і preview збирається

**Очікуваний результат:** Preview показує стартову сторінку без runtime errors.

**Якщо не збирається:**
- Перевір що `package.json` і `package-lock.json` актуальні
- Lovable автоматично встановить залежності при першому запуску
- Якщо помилка TypeScript — перевір що всі файли з `src/` скопійовані

---

## 3. Перенести ENV змінні

| KEY | Де використовується | Значення | Типова помилка |
|-----|---------------------|----------|----------------|
| `VITE_MCP_GATEWAY_URL` | `src/lib/api/mcpGatewayClient.ts:18` | URL Cloudflare Worker (напр. `https://garden-mcp-server.maxfraieho.workers.dev`) | Без `https://` або з trailing `/` — API calls повертають 404 |

> **Примітка:** Це єдина ENV змінна фронтенду. Якщо не задана — використовується `DEFAULT_GATEWAY` з `mcpGatewayClient.ts:14`.

### Як додати у Lovable:

В Lovable немає `.env` файлу. `VITE_MCP_GATEWAY_URL` захардкоджена як fallback у коді (`DEFAULT_GATEWAY`). Якщо Worker URL змінився — оновити рядок 14 у `src/lib/api/mcpGatewayClient.ts`:

```typescript
const DEFAULT_GATEWAY = 'https://YOUR-NEW-WORKER-URL.workers.dev';
```

---

## 4. Smoke-тест (6 перевірок)

| # | Перевірка | Як | Очікуваний результат |
|---|-----------|-----|---------------------|
| 1 | Preview відкривається | Натиснути Preview у Lovable | Сторінка без білого екрану |
| 2 | Немає critical console errors | F12 → Console | Немає червоних помилок (warnings OK) |
| 3 | Діагностика | Відкрити `/admin/settings` → вкладка Діагностика | Сторінка рендериться |
| 4 | Ping /health | На сторінці діагностики натиснути "Ping /health" | `{"status":"ok"}` |
| 5 | Auth status | Натиснути "Check /auth/status" | Відповідь (не 404) |
| 6 | Навігація | Home → Files → Chat → Graph → Editor → DRAKON | Всі сторінки відкриваються |

---

## 5. Типові помилки → швидке виправлення

| Помилка | Причина | Фікс |
|---------|---------|------|
| CORS error у консолі | Lovable preview URL не в ALLOWED_ORIGINS Worker | Додати URL у Worker або `Access-Control-Allow-Origin: *` |
| 401 Unauthorized на /health | Worker вимагає auth для /health | /health має бути публічним |
| 404 на API calls | Неправильний `DEFAULT_GATEWAY` URL | Оновити `mcpGatewayClient.ts:14` |
| Trailing slash | `https://worker.dev/` замість `https://worker.dev` | Видалити trailing `/` |
| Білий екран | Build error або відсутній файл | Console → Network, перезапустити preview |
| "fetch failed" | Worker не відповідає | Перевірити Worker deployment у Cloudflare Dashboard |
| ERR_ABORTED preflight | Відсутній `X-Correlation-Id` в дозволених заголовках | Додати до `Access-Control-Allow-Headers` у Worker |

---

## 6. Після міграції

- [ ] Перевірити що Owner Login працює
- [ ] Перевірити Access Zones
- [ ] Оновити `_collab/agents/lovable/NEW_ACCOUNT_ONBOARDING.md` з новими URL

---

## 7. Rollback (5 хвилин)

Повернути `DEFAULT_GATEWAY` у `mcpGatewayClient.ts:14` на старе значення:

```typescript
const DEFAULT_GATEWAY = 'https://garden-mcp-server.maxfraieho.workers.dev';
```

Зберегти → preview перезапуститься автоматично.

---

## Семантичні зв'язки

**Цей документ є частиною:**
- [[exodus.pp.ua/operations/migration/_INDEX|Migration Pack]]

**Пов'язані документи:**
- [[exodus.pp.ua/operations/migration/REPLIT_МІГРАЦІЯ_НОВИЙ_АКАУНТ|REPLIT_МІГРАЦІЯ_НОВИЙ_АКАУНТ]] — міграція бекенду
- [[exodus.pp.ua/operations/migration/STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ|STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ]] — стартер для агента

---
