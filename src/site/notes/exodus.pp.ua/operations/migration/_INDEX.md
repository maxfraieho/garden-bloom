---
{"tags":["domain:operations","status:canonical","format:index"],"created":"2026-02-24","updated":"2026-02-24","title":"Migration Pack","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/operations/migration/","dgPassFrontmatter":true,"noteIcon":""}
---

# Migration Pack

> Набір документів для повторюваної міграції бекенду та фронтенду Garden Bloom на нові акаунти.

---

## Документи

| Документ | Призначення |
|----------|-------------|
| [[exodus.pp.ua/operations/migration/REPLIT_МІГРАЦІЯ_НОВИЙ_АКАУНТ\|REPLIT_МІГРАЦІЯ_НОВИЙ_АКАУНТ]] | Повний плейбук міграції Replit бекенду + Cloudflare Worker |
| [[exodus.pp.ua/operations/migration/LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ\|LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ]] | Повний плейбук міграції Lovable фронтенду |
| [[exodus.pp.ua/operations/migration/STARTER_ДЛЯ_LOVABLE_АГЕНТА\|STARTER_ДЛЯ_LOVABLE_АГЕНТА]] | Стартер для агента: міграція бекенду |
| [[exodus.pp.ua/operations/migration/STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ\|STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ]] | Стартер для агента: міграція фронтенду |

---

## Порядок міграції

1. Спочатку мігрувати **Replit бекенд** → перевірити curl
2. Потім оновити **Cloudflare Worker** → перевірити `/health`
3. Потім мігрувати **Lovable фронтенд** → smoke-тест UI

---

## Семантичні зв'язки

**Цей документ є частиною:**
- [[exodus.pp.ua/ІНДЕКС|ІНДЕКС]] — головний індекс документації

---
