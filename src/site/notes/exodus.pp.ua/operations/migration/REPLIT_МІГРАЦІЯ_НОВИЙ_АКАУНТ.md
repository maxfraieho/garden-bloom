---
{"tags":["domain:operations","status:canonical","format:playbook"],"created":"2026-02-24","updated":"2026-02-24","title":"REPLIT МІГРАЦІЯ НОВИЙ АКАУНТ","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/operations/migration/REPLIT_МІГРАЦІЯ_НОВИЙ_АКАУНТ/","dgPassFrontmatter":true,"noteIcon":""}
---

# Міграція бекенду на новий Replit акаунт

> Версія: 2026-02-24 | Час виконання: ~30 хв

---

## 0. Перед стартом

**Що потрібно мати:**

| Ресурс | Де взяти |
|--------|----------|
| Новий Replit акаунт | [replit.com](https://replit.com) |
| GitHub Classic PAT | GitHub → Settings → Developer settings → Personal access tokens → Classic |
| Доступ до Cloudflare | Dashboard або `wrangler` CLI |
| Поточний Worker URL | `https://garden-mcp-server.maxfraieho.workers.dev` |
| Репозиторій | `maxfraieho/garden-seedling` |

**GitHub PAT має мати права:** `repo`, `workflow`.

---

## 1. Replit: створення проєкту

1. **Import from GitHub**: `https://github.com/maxfraieho/garden-seedling`
   - або створи порожній Python Repl і вручну додай файли бекенду
2. **Run command**: `python main.py` (або `uvicorn main:app --host 0.0.0.0 --port 8000`)
3. Дочекайся зеленого статусу — Replit покаже публічний URL

**Запиши URL** — він буде виглядати як `https://<назва-проєкту>.<username>.replit.app`

---

## 2. Replit Secrets

Додай у **Tools → Secrets**:

| Key | Де взяти | Формат | Типова помилка |
|-----|----------|--------|----------------|
| `SERVICE_TOKEN` | Вигадай або візьми старий | `garden-nlm-service-2026-xxxxx` | Порожній рядок → 401 на всіх endpoints |
| `GITHUB_PAT` | GitHub → Settings → PAT | `ghp_...` (40+ символів) | PAT без прав `repo` → 404 від GitHub API |
| `GITHUB_REPO` | Фіксоване | `maxfraieho/garden-seedling` | Зайвий `https://` → помилка парсингу |
| `GITHUB_BRANCH` | Фіксоване | `main` | Інша гілка → коміти йдуть не туди |

> ⚠️ `DATABASE_URL` — опціональний, потрібен тільки якщо бекенд використовує PostgreSQL.

---

## 3. Перевірка бекенду (curl)

Замінюй `$REPLIT` на URL з кроку 1, `$TOKEN` на значення `SERVICE_TOKEN`.

### 3.1 Health check (без авторизації)

```bash
curl $REPLIT/health
```

✅ Очікувано: `{"status":"ok","version":"1.0.0"}`
❌ Якщо таймаут — Repl ще стартує (cold start до 30 сек), спробуй ще раз.

### 3.2 Git status

```bash
curl -H "Authorization: Bearer $TOKEN" "$REPLIT/v1/git/status?path=README.md"
```

✅ Очікувано: `{"exists":true,"sha":"abc123..."}`
❌ `401` — перевір SERVICE_TOKEN. `404` — перевір GITHUB_PAT і GITHUB_REPO.

### 3.3 Git commit (тестовий)

```bash
curl -X POST "$REPLIT/v1/git/commit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"path":"_test/migration-check.md","content":"ok","message":"migration: smoke test"}'
```

✅ Очікувано: `{"success":true,"sha":"...","url":"..."}`
❌ `422` — перевір JSON body. `403` — PAT не має прав на repo.

> Після тесту видали `_test/migration-check.md` з репо.

### 3.4 DRAKON commit

```bash
curl -X POST "$REPLIT/v1/drakon/commit" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"folderSlug":"exodus.pp.ua","diagramId":"test-mig","diagram":{"type":"drakon"},"name":"Test","isNew":true}'
```

✅ Очікувано: `{"success":true,...}`

---

## 4. Cloudflare Worker: оновити на новий бекенд

### Що міняти

У Worker використовуються **2 env-змінні** для бекенду:

| Змінна | Що це | Нове значення |
|--------|-------|---------------|
| `NOTEBOOKLM_BASE_URL` | URL Replit бекенду (git, drakon, chat) | `https://<новий>.replit.app` |
| `NOTEBOOKLM_SERVICE_TOKEN` | Bearer token для бекенду | Значення `SERVICE_TOKEN` з кроку 2 |

### Як оновити

**Варіант A — Wrangler CLI:**

```bash
wrangler secret put NOTEBOOKLM_BASE_URL
# Вставити: https://<новий>.replit.app

wrangler secret put NOTEBOOKLM_SERVICE_TOKEN
# Вставити: garden-nlm-service-2026-xxxxx
```

**Варіант B — Cloudflare Dashboard:**
Workers & Pages → `garden-mcp-server` → Settings → Variables and Secrets → Edit

### Перевірка Worker → Backend

```bash
curl https://garden-mcp-server.maxfraieho.workers.dev/health
```

✅ Очікувано: `{"ok":true,...}` (Worker повертає health бекенду)

```bash
curl -X POST https://garden-mcp-server.maxfraieho.workers.dev/auth/status
```

✅ Очікувано: `200` з JSON (не 502/503)

---

## 5. Фронтенд: оновити URL

Фронтенд спілкується **тільки** з Cloudflare Worker (не напряму з Replit).

**Єдине місце де прописаний Worker URL:**

```
src/lib/api/mcpGatewayClient.ts → рядок 14
const DEFAULT_GATEWAY = 'https://garden-mcp-server.maxfraieho.workers.dev';
```

**Якщо Worker URL не змінився** → фронтенд оновлювати не потрібно.

**Якщо Worker URL змінився** → онови `DEFAULT_GATEWAY`.

---

## 6. Smoke-тест UI

1. Відкрий фронтенд у браузері
2. Перейди на `/admin/settings` → вкладка "Діагностика"
3. Перевір статус підключення — має бути зелений
4. Спробуй створити/зберегти нотатку — має з'явитись коміт у GitHub
5. Відкрий DevTools → Network — запити мають іти на Worker URL

---

## 7. Rollback (5 хвилин)

Повернути старі значення у Worker:

```bash
wrangler secret put NOTEBOOKLM_BASE_URL
# Вставити старий URL: https://notebooklm-gateway-1.replit.app

wrangler secret put NOTEBOOKLM_SERVICE_TOKEN
# Вставити старий токен
```

Фронтенд: якщо змінювався `DEFAULT_GATEWAY` — поверни старе значення і задеплой.

---

## 8. Пастки міграції

| # | Пастка | Симптом | Рішення |
|---|--------|---------|---------|
| 1 | **Trailing slash** в URL | `502`, `404` | URL без `/` в кінці |
| 2 | **CORS** | Preflight errors в консолі | Бекенд FastAPI має `allow_origins=["*"]` |
| 3 | **Cold start** Replit | Перший запит таймаутиться | Worker має retry з backoff; або wake Repl вручну |
| 4 | **PAT без прав** | `404` від GitHub API | PAT має мати scope `repo` |
| 5 | **Кеш Worker** | Старі відповіді після зміни secrets | Зачекати 30 сек або re-deploy Worker |
| 6 | **http замість https** | Mixed content | Replit завжди https |
| 7 | **Не той SERVICE_TOKEN** | `401` на всіх endpoints | Значення в Replit ≡ значення в Worker |
| 8 | **Неправильний GITHUB_REPO** | `404` при git operations | Формат: `owner/repo` |
| 9 | **Старий fallback у Worker** | Worker ходить на старий URL | Переконатись що `NOTEBOOKLM_BASE_URL` встановлено |
| 10 | **ERR_ABORTED preflight** | CORS блокує запити | Додати `X-Correlation-Id` до дозволених заголовків Worker |

---

## Семантичні зв'язки

**Цей документ є частиною:**
- [[exodus.pp.ua/operations/migration/_INDEX|Migration Pack]] — набір документів для міграції

**Пов'язані документи:**
- [[exodus.pp.ua/operations/migration/LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ|LOVABLE_МІГРАЦІЯ_НОВИЙ_АКАУНТ]] — міграція фронтенду
- [[exodus.pp.ua/operations/migration/STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ|STARTER_ДЛЯ_LOVABLE_НОВИЙ_АКАУНТ]] — стартер для Lovable агента
- [[exodus.pp.ua/operations/migration/STARTER_ДЛЯ_LOVABLE_АГЕНТА|STARTER_ДЛЯ_LOVABLE_АГЕНТА]] — стартер для Replit міграції

---
