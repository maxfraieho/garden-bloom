---
{"tags":["domain:operations","status:canonical","format:starter"],"created":"2026-02-24","updated":"2026-02-24","title":"STARTER ДЛЯ LOVABLE НОВИЙ АКАУНТ","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/operations/migration/STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ/","dgPassFrontmatter":true,"noteIcon":""}
---

# Starter: Lovable міграція на новий акаунт

> Цей документ — інструкція для нового Lovable агента. Повний плейбук: [[exodus.pp.ua/operations/migration/LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ|LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ]]

---

## Що треба зробити

1. **Проєкт**: створити порожній React проєкт у новому Lovable акаунті, підключити GitHub
2. **Код**: користувач скопіює код з Git — дочекатися підтвердження
3. **ENV**: оновити `DEFAULT_GATEWAY` у `src/lib/api/mcpGatewayClient.ts:14` якщо Worker URL змінився
4. **Build**: переконатися що preview збирається без помилок
5. **Smoke-тест**: пройти 6 перевірок (preview, console, діагностика, health, auth, навігація)
6. **Ознайомлення**: прочитати `_collab/agents/lovable/NEW_ACCOUNT_ONBOARDING.md` для повного розуміння архітектури
7. **Звіт**: повідомити результати smoke-тесту користувачу

---

## Що я дам (секрети/посилання)

| Плейсхолдер | Опис |
|-------------|------|
| `$WORKER_URL` | URL Cloudflare Worker (напр. `https://garden-mcp-server.maxfraieho.workers.dev`) |
| `$GITHUB_REPO` | GitHub репозиторій з кодом |

> Інших секретів для фронтенду немає. Всі API ключі зберігаються у Worker/Replit.

---

## Критерії "Готово"

- [ ] Preview відкривається без runtime errors
- [ ] Console без critical errors
- [ ] `/admin/settings` → Діагностика рендериться
- [ ] Ping /health → відповідь від Worker
- [ ] Навігація по всіх сторінках працює
- [ ] Агент ознайомився з архітектурою проєкту

---

## Семантичні зв'язки

**Цей документ є частиною:**
- [[exodus.pp.ua/operations/migration/_INDEX|Migration Pack]]

---
