# Backend

API контракти та специфікації бекенд-сервісів Garden Bloom.

---

## Маршрут читання для backend developer

```
1. КОНТРАКТИ_API_V1.md                  — canonical API contracts
2. ../memory/ARCHITECTURE.md            — Memory subsystem architecture
3. ../memory/API_CONTRACT.md            — Memory API implementation details
4. _collab/infrastructure/cloudflare/   — Worker proxy (production gateway)
```

> **Note:** Для deployment, nginx routing та operations див. `_collab/infrastructure/`.
> Для Memory API prompts (Replit Agent) див. `docs/memory/prompts/`.

---

## Файли

| Файл | Роль | Статус |
|------|------|--------|
| [[КОНТРАКТИ_API_V1]] | Canonical API schemas та endpoints | ✅ canonical |
| [[BACKEND_DOCS_AUDIT_REPORT]] | Аудит документації backend (2026-03-08) | audit artifact |
| [[NGINX_MEMORY_ROUTING]] | Nginx routing для Memory API | ✅ operational guide |
| [[MEMORY_API_SMOKE_TESTS]] | Smoke tests для Memory API endpoints | ✅ operational guide |

---

## Пов'язані пакети

| Директорія | Роль | Опис |
|------------|------|------|
| `docs/memory/` | Implementation guides + prompts | Memory API деталізація, Mastra agents |
| `_collab/infrastructure/cloudflare/worker/` | Gateway code | Cloudflare Worker proxy |
| `_collab/infrastructure/n8n-migration/` | n8n migration | Redis, adapter, nginx config |

---

## TODO (з аудиту 2026-03-08)

- [x] **NGINX_MEMORY_ROUTING.md** — nginx routing `/v1/memory/*` → backend ✅ Created
- [x] **MEMORY_API_SMOKE_TESTS.md** — automated test suite ✅ Created
- [ ] **BACKEND_DEPLOYMENT_GUIDE.md** — повний deployment guide (environment setup, Replit → production, monitoring, rollback)
- [ ] **BACKEND_ONBOARDING.md** — consolidation guide для backend developer (setup → implementation → deployment → monitoring)
