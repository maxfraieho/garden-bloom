# Starter для Lovable агента: міграція бекенду

> Цей документ — вхідна точка для агента. Повний плейбук: `REPLIT_МІГРАЦІЯ_НОВИЙ_АКАУНТ.md`

---

## Що треба зробити

1. **Replit**: створити/імпортувати FastAPI бекенд на новому акаунті з GitHub-репо `maxfraieho/garden-seedling`
2. **Replit Secrets**: додати `SERVICE_TOKEN`, `GITHUB_PAT`, `GITHUB_REPO`, `GITHUB_BRANCH`
3. **Перевірити бекенд**: curl `/health`, `/v1/git/status`, `/v1/git/commit` — всі 200
4. **Cloudflare Worker**: оновити `NOTEBOOKLM_BASE_URL` і `NOTEBOOKLM_SERVICE_TOKEN` на нові значення
5. **Перевірити Worker**: curl `https://garden-mcp-server.maxfraieho.workers.dev/health` → 200
6. **Фронтенд**: якщо Worker URL змінився — оновити `DEFAULT_GATEWAY` в `src/lib/api/mcpGatewayClient.ts:14`
7. **Smoke-тест UI**: `/admin/settings` → Діагностика → зелений статус; створити нотатку → коміт у GitHub

---

## Що я дам (секрети/посилання)

| Плейсхолдер | Опис |
|-------------|------|
| `$NEW_REPLIT_URL` | URL нового Replit бекенду (напр. `https://garden-backend.newuser.replit.app`) |
| `$SERVICE_TOKEN` | Bearer token для авторизації бекенду |
| `$GITHUB_PAT` | GitHub Classic PAT з правами `repo`, `workflow` |
| `$GITHUB_REPO` | `maxfraieho/garden-seedling` |
| `$CF_API_TOKEN` | Cloudflare API token (якщо потрібен wrangler) |

---

## Критерії "Готово"

- [ ] `/health` на новому бекенді → `{"status":"ok"}`
- [ ] `/v1/git/status?path=README.md` → `{"exists":true}`
- [ ] `/v1/git/commit` тестовий файл → `{"success":true}`
- [ ] Worker `/health` → відповідь від нового бекенду (не 502)
- [ ] Worker `/auth/status` → 200
- [ ] UI: `/admin/settings` → Діагностика → зелений статус
- [ ] UI: збереження нотатки створює коміт у GitHub
