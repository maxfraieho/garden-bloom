---
tags:
  - domain:runtime
  - status:completed
  - layer:operations
  - format:report
created: 2026-02-26
title: "PROD_REPO_SWITCH_REPORT_2026-02-26"
---

# Production Repo Switch Report — 2026-02-26

> Оператор: Claude (Alpine сервер)
> Дата: 2026-02-26 23:06–23:22 EET

---

## Вихідний стан

| Параметр | Значення |
|----------|---------|
| Старий remote | `git@github.com:maxfraieho/membridge.git` |
| Старий HEAD commit | `61fd24d0f41c8969a70ed397cfa7c0863846ca19` |
| Старий git status | clean |
| Стан сервісу | `crashed` (bloom-runtime) |

---

## Новий стан

| Параметр | Значення |
|----------|---------|
| Новий remote | `git@github.com:maxfraieho/bloom-core-ui.git` |
| Новий HEAD commit | `b897da9` — "Integrate remote server URL" |
| Гілка | `main` |

---

## Backup

- Шлях: `/home/vokov/backup/membridge_20260226_2306.tar.gz`
- Розмір: 35 MB
- Вміст: весь репо без `.git` та `node_modules`
- Відновлені з backup: `.env.server`, `.env.agent`, symlink `config.env → /home/vokov/.claude-mem-minio/config.env`

---

## Спосіб міграції

**Варіант A** — `git remote set-url` + `git reset --hard` + `git clean -fdx`

---

## Виконані команди (хронологія)

```bash
# 0. Backup
tar --exclude='.git' --exclude='node_modules' -czf /home/vokov/backup/membridge_20260226_2306.tar.gz -C /home/vokov membridge

# 1. Переключення remote
git remote set-url origin git@github.com:maxfraieho/bloom-core-ui.git
git fetch --all --prune
git checkout main
git reset --hard origin/main
git clean -fdx

# 1.1 Відновлення env файлів з backup
cp /tmp/restore_env/membridge/.env.server /home/vokov/membridge/.env.server
cp /tmp/restore_env/membridge/.env.agent /home/vokov/membridge/.env.agent
ln -sf /home/vokov/.claude-mem-minio/config.env /home/vokov/membridge/config.env

# 2. Залежності та білд
npm ci
npm run build

# 3. Міграція схеми БД (runbook крок 3)
export $(grep -v '^#' /etc/bloom-runtime.env | xargs)
npx drizzle-kit push   # → [✓] Changes applied

# 4. Перезапуск сервісу
sudo rc-service bloom-runtime stop && sleep 2 && sudo rc-service bloom-runtime start

# 5. Python залежності (git clean видалив .venv)
uv sync

# 6. Pytest
MEMBRIDGE_DEV=1 MEMBRIDGE_AGENT_DRYRUN=1 uv run python -m pytest tests/ -v
```

---

## Проблеми та фікси

| # | Проблема | Фікс |
|---|----------|------|
| 1 | `column "agent_version" does not exist` при `/api/runtime/stats` | `npx drizzle-kit push` — схема оновлена |
| 2 | `fastapi` не знайдено для pytest | `uv sync` — відновлено `.venv` (видалено `git clean`) |
| 3 | `source /etc/bloom-runtime.env` не передало env в `npx` | замінено на `export $(grep -v '^#' /etc/bloom-runtime.env | xargs)` |

---

## Результати smoke tests

### Runtime API

| Endpoint | HTTP | Результат |
|----------|------|-----------|
| `GET /api/runtime/health` | 200 | `status: ok`, `storage: postgresql`, `membridge.connected: true` |
| `GET /api/runtime/stats` | 200 | tasks: 1 queued, workers: 0, leases: 0 |
| `GET /api/runtime/workers` | 200 | `[]` (немає workers — очікувано) |
| `GET /api/runtime/config` | 200 | `membridge_server_url: http://127.0.0.1:8000` |
| `GET /api/runtime/audit?limit=5` | 200 | 3 записи (персистовані з PostgreSQL) |
| `GET /api/runtime/projects` | 200 | `[]` |
| `GET /api/runtime/agent-install-script?node_id=test-node` | 200 | bash-скрипт згенеровано |
| `POST /api/runtime/test-connection` | 200 | `connected: true` |
| `POST /api/runtime/llm-tasks` | 200 | task створено (`6ab13a9a`) |
| `POST /api/runtime/llm-tasks/{id}/lease` | — | `"No available worker"` — очікувано |

### Membridge Proxy

| Endpoint | HTTP | Результат |
|----------|------|-----------|
| `GET /api/membridge/health` | 200 | `status: ok`, `version: 0.3.0` |
| `GET /api/membridge/projects` | 200 | 2 проєкти: `garden-seedling`, `verify-heartbeat-test` |

### nginx + frontend

| Тест | Результат |
|------|-----------|
| `GET http://127.0.0.1:80/` | 200 |
| `GET http://127.0.0.1:80/api/runtime/health` | 200 |
| SPA JS asset | 200 |

### pytest

```
50 passed in 36.73s
```

---

## Кінцевий стан сервісів

| Сервіс | Стан |
|--------|------|
| bloom-runtime | started |
| membridge-server | started |
| nginx | started |
| postgresql | started |

## Білд

| Артефакт | Розмір |
|----------|--------|
| `dist/index.cjs` | 1.1 MB |
| `dist/public/assets/index-*.js` | 363.5 KB |
| `dist/public/assets/index-*.css` | 70.45 KB |

---

## Відома невідповідність (не критично)

`/api/runtime/agent-install-script` генерує `REPO_URL=https://github.com/maxfraieho/membridge.git` — стара адреса захардкоджена в серверному коді (`server/routes.ts` або подібне). Не впливає на runtime, але потребує окремого фіксу якщо install script використовується реально.

---

## Як відкотитись

```bash
# Відновити з backup:
cd /home/vokov
tar -xzf backup/membridge_20260226_2306.tar.gz

# АБО через git (повернутись до старого remote + commit):
git remote set-url origin git@github.com:maxfraieho/membridge.git
git fetch --all
git reset --hard 61fd24d0f41c8969a70ed397cfa7c0863846ca19

# Перебудувати:
npm install && npm run build

# Перезапустити:
sudo rc-service bloom-runtime restart
```

---

*Звіт створено автоматично оператором Claude після завершення міграції.*
