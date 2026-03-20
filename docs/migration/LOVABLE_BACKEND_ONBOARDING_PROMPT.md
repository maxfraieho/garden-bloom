# Онбордінг-промпт для Lovable агента: бекенд Garden Bloom

> Скопіюй цей текст як перше повідомлення в новому Lovable проєкті з імпортованим кодом бекенду.

---

## Промпт

```
Цей проєкт — бекенд для Garden Bloom. Це НЕ фронтенд-застосунок. Не створюй UI, не додавай React-компоненти, не запускай preview.

## Що це за проєкт

Бекенд складається з двох сервісів:

### 1. NotebookLM Backend (Python/FastAPI, порт 5000)
- Точка входу: `app/main.py`
- Залежності: `requirements.txt`
- Запуск: `python -m uvicorn app.main:app --host 0.0.0.0 --port 5000`
- Модулі:
  - `app/routes/api_v1.py` — API v1 (git operations, DRAKON, chat, proposals)
  - `app/routes/auth.py` — автентифікація
  - `app/services/github_service.py` — GitHub API (коміти, файли)
  - `app/services/minio_service.py` — MinIO/S3 сховище
  - `app/services/notebooklm_service.py` — NotebookLM інтеграція
  - `app/config.py` — конфігурація з ENV

### 2. Memory Backend (TypeScript/Fastify, порт 3001)
- Точка входу: `src/server.ts`
- Залежності: `package.json`
- Запуск: `npx tsx src/server.ts`
- Модулі:
  - `src/routes/memory.ts` — API пам'яті агентів
  - `src/memory/` — BM25 пошук, git store, entity manager, контекст
  - `src/agents/` — writer, searcher агенти

## Інфраструктура розгортання

Бекенд розгортається на фізичному Linux-сервері в локальній мережі. Доступ ззовні — через Cloudflare Tunnel.

### Архітектура:
```
Фронтенд (Lovable) → Cloudflare Worker → Cloudflare Tunnel → Локальний сервер
                                                                ├── FastAPI :5000
                                                                └── Fastify :3001
```

### Cloudflare Tunnel:
- Тунель надає HTTPS-доступ до локального сервера
- Worker (`garden-mcp-server.maxfraieho.workers.dev`) проксює запити через тунель
- Потрібно налаштувати `cloudflared` на сервері

### ENV змінні сервера:
| Змінна | Опис |
|--------|------|
| `SERVICE_TOKEN` | Bearer token для авторизації API |
| `GITHUB_PAT` | GitHub Classic PAT (scope: repo, workflow) |
| `GITHUB_REPO` | `maxfraieho/garden-seedling` |
| `GITHUB_BRANCH` | `main` |
| `MINIO_ENDPOINT` | `https://apiminio.exodus.pp.ua` |
| `MINIO_BUCKET` | `mcpstorage` |
| `MINIO_ACCESS_KEY` | Ключ доступу MinIO |
| `MINIO_SECRET_KEY` | Секретний ключ MinIO |

## Cloudflare Worker

Код воркера знаходиться у `cloudflare_worker/index.js` (та `worker_fixed/index.js` — виправлена версія).
Worker проксює запити від фронтенду до бекенду. Ключові env Worker:
- `NOTEBOOKLM_BASE_URL` — URL бекенду через тунель (напр. `https://garden-backend.example.com`)
- `NOTEBOOKLM_SERVICE_TOKEN` — токен авторизації
- `MEMORY_BACKEND_URL` — URL Memory API (якщо окремий)

## Фронтенд (тільки для довідки, не редагувати)

Готовий фронтенд доступний за адресою: https://garden-buddy-agent.lovable.app
Він спілкується з Worker за адресою: `https://garden-mcp-server.maxfraieho.workers.dev`

## Що від тебе очікується

1. **Код бекенду** — редагувати Python/TypeScript файли сервісів
2. **Docker/systemd** — створити конфігурацію для розгортання на сервері
3. **Cloudflare Tunnel** — конфіг для `cloudflared`
4. **Документація** — оновлювати docs при змінах
5. **НЕ створювати** UI, React компоненти, HTML сторінки (окрім серверних шаблонів)

## Перша задача

Створи інфраструктуру для розгортання на локальному сервері:
1. `docker-compose.yml` для обох сервісів (FastAPI + Fastify)
2. `Dockerfile` для кожного сервісу
3. Конфіг `cloudflared` (config.yml) для Cloudflare Tunnel
4. `.env.example` з усіма змінними
5. `deploy.sh` — скрипт розгортання
6. `README.md` — інструкція запуску

Сервер: Ubuntu 22.04, Docker + docker-compose встановлені, cloudflared буде встановлено.
```

---

## Після вставки промпту

1. Lovable агент створить Docker/deployment конфіги
2. Ти отримаєш файли через GitHub sync
3. Клонуєш на сервер, налаштуєш `.env`, запускаєш `docker-compose up -d`
4. Встановлюєш cloudflared, запускаєш тунель
5. Оновлюєш Worker secrets (`NOTEBOOKLM_BASE_URL` → URL тунелю)
6. Smoke-тест з фронтенду
