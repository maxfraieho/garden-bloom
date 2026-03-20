# Промпт для бекенд-агента Lovable: розгортання Garden Bloom на локальному сервері

> Скопіюй текст між ``` як перше повідомлення в Lovable-проєкті з імпортованим кодом бекенду.

---

## Промпт

```
Цей проєкт — бекенд для Garden Bloom. Це НЕ фронтенд-застосунок.
НЕ створюй UI, НЕ додавай React-компоненти, НЕ запускай preview.

## Контекст

Готовий фронтенд: https://garden-buddy-agent.lovable.app
Фронтенд спілкується з Cloudflare Worker: https://garden-mcp-server.maxfraieho.workers.dev
Worker проксує запити до бекенду через Cloudflare Tunnel.

Зараз бекенд НЕ працює (Replit акаунт вичерпав кредити). Треба розгорнути його на локальному фізичному сервері (Ubuntu 22.04) і дати доступ через Cloudflare Tunnel.

## Архітектура

```
Браузер → Lovable (фронтенд)
  → Cloudflare Worker (garden-mcp-server.maxfraieho.workers.dev)
    → Cloudflare Tunnel (HTTPS)
      → Локальний сервер (Ubuntu 22.04)
        ├── NotebookLM API (Python/FastAPI) :5000
        └── Memory API (TypeScript/Fastify) :3001
```

## Два сервіси бекенду

### 1. NotebookLM Backend (FastAPI, порт 5000)
- Точка входу: `app/main.py`
- Залежності: `requirements.txt`
- Запуск: `python -m uvicorn app.main:app --host 0.0.0.0 --port 5000`
- Ключові маршрути:
  - `POST /auth/setup` — ініціалізація пароля
  - `POST /auth/login` — логін, повертає JWT
  - `POST /auth/validate` — перевірка JWT
  - `GET /health` — здоров'я (ПУБЛІЧНИЙ, без авторизації)
  - `GET /v1/git/status` — статус git
  - `POST /notebooklm/chat` — чат через NotebookLM
  - `GET/POST /zones/*` — управління зонами доступу
  - `GET/PATCH /proposals/*` — система пропозицій

### 2. Memory Backend (Fastify, порт 3001)
- Точка входу: `src/server.ts`
- Залежності: `package.json`
- Запуск: `npx tsx src/server.ts`
- Маршрути: `/memory/*` — пам'ять агентів, BM25 пошук

## ENV змінні сервера

| Змінна | Опис | Обов'язкова |
|--------|------|-------------|
| `SERVICE_TOKEN` | Bearer token для Worker→Backend авторизації | ✅ |
| `GITHUB_PAT` | GitHub Classic PAT (scope: repo) | ✅ |
| `GITHUB_REPO` | `maxfraieho/garden-seedling` | ✅ |
| `GITHUB_BRANCH` | `main` | ✅ |
| `MINIO_ENDPOINT` | `https://apiminio.exodus.pp.ua` | ⚠️ якщо MinIO |
| `MINIO_BUCKET` | `mcpstorage` | ⚠️ якщо MinIO |
| `MINIO_ACCESS_KEY` | Ключ доступу MinIO | ⚠️ якщо MinIO |
| `MINIO_SECRET_KEY` | Секретний ключ MinIO | ⚠️ якщо MinIO |

## Cloudflare Worker — як він проксює

Worker шукає env змінну `NOTEBOOKLM_BASE_URL`. Поточний fallback:
```
https://notebooklm-gateway.replit.app
```
Після розгортання тунелю цю змінну треба оновити на URL тунелю в Cloudflare Dashboard → Workers → garden-mcp-server → Settings → Variables.

Worker також використовує `NOTEBOOKLM_SERVICE_TOKEN` для авторизації запитів до бекенду.

## ПЕРША ЗАДАЧА: створи інфраструктуру розгортання

Створи всі файли для розгортання на Ubuntu 22.04 сервері:

### 1. Docker конфігурація
- `docker/Dockerfile.api` — для FastAPI сервісу (Python 3.11)
- `docker/Dockerfile.memory` — для Memory сервісу (Node 20)
- `docker-compose.yml` — обидва сервіси + healthcheck + restart policy
- `docker-compose.override.yml` — dev overrides (bind mounts, debug logs)

### 2. Cloudflare Tunnel
- `infrastructure/cloudflared/config.yml` — конфіг тунелю:
  - `*.garden-backend.exodus.pp.ua` → `http://localhost:5000` (основний API)
  - Окремий ingress для memory: `/memory/*` → `http://localhost:3001`
  - АБО один ingress на nginx reverse proxy
- `infrastructure/cloudflared/install.sh` — скрипт встановлення cloudflared
- Документація: як створити тунель через `cloudflared tunnel create garden-backend`

### 3. Reverse Proxy (nginx)
- `infrastructure/nginx/nginx.conf` — проксі перед двома сервісами:
  - `/memory/*` → `localhost:3001`
  - Все інше → `localhost:5000`
  - Тунель вказує тільки на nginx (:80)

### 4. Скрипти
- `.env.example` — шаблон з усіма змінними
- `deploy.sh` — повний скрипт розгортання:
  1. Перевірка залежностей (Docker, cloudflared)
  2. Копіювання `.env` якщо відсутній
  3. `docker-compose up -d --build`
  4. Healthcheck loop (curl /health)
  5. Інструкція для налаштування тунелю
- `scripts/healthcheck.sh` — перевірка обох сервісів

### 5. Документація
- `README.md` — покрокова інструкція:
  1. Клонування репо на сервер
  2. Налаштування `.env`
  3. Запуск `./deploy.sh`
  4. Створення Cloudflare Tunnel
  5. Оновлення Worker secrets
  6. Smoke-тест

## Вимоги до Docker

- Використовуй multi-stage builds для зменшення розміру образів
- Healthcheck в Dockerfile для кожного сервісу
- Non-root user
- `.dockerignore` для виключення зайвого

## Smoke-тест після розгортання

Після запуску перевір:
1. `curl http://localhost:5000/health` → `{"status":"ok"}`
2. `curl http://localhost:3001/health` → відповідь
3. `curl https://TUNNEL-URL/health` → `{"status":"ok"}` через тунель
4. Фронтенд: https://garden-buddy-agent.lovable.app → Settings → Diagnostics → Ping /health

## ЗАБОРОНИ

- ❌ НЕ створюй React компоненти або фронтенд
- ❌ НЕ змінюй package.json фронтенду
- ❌ НЕ додавай Vite, Tailwind або інші фронтенд-залежності
- ❌ НЕ запускай `npm run dev` для preview
```

---

## Покроковий план (для власника)

### Фаза 1: Інфраструктура (бекенд-агент)
1. Вставити промпт вище в новий Lovable проєкт
2. Агент створить Docker/nginx/cloudflared конфіги
3. Отримати файли через GitHub sync

### Фаза 2: Розгортання (ти на сервері)
4. `git clone` репо на сервер
5. Скопіювати `.env.example` → `.env`, заповнити секрети
6. `./deploy.sh` — запускає Docker контейнери
7. Перевірити `curl localhost:5000/health`

### Фаза 3: Cloudflare Tunnel (ти + Cloudflare Dashboard)
8. `cloudflared tunnel create garden-backend`
9. `cloudflared tunnel route dns garden-backend garden-backend.exodus.pp.ua`
10. `cloudflared tunnel run garden-backend`
11. Перевірити `curl https://garden-backend.exodus.pp.ua/health`

### Фаза 4: З'єднання з фронтендом (Cloudflare Dashboard)
12. Workers → garden-mcp-server → Settings → Variables
13. Оновити `NOTEBOOKLM_BASE_URL` = `https://garden-backend.exodus.pp.ua`
14. Оновити `NOTEBOOKLM_SERVICE_TOKEN` = твій SERVICE_TOKEN

### Фаза 5: Smoke-тест (фронтенд-агент — цей проєкт)
15. Відкрити https://garden-buddy-agent.lovable.app
16. Settings → Diagnostics → Ping /health → має бути ОК
17. Перевірити авторизацію, навігацію, чат
