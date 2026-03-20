---
tags:
  - domain:runtime
  - status:canonical
  - layer:operations
  - authority:production
created: 2026-02-25
updated: 2026-02-27
legacy_name: "ВЕРИФІКАЦІЯ_ШЛЯХУ_ВИКОНАННЯ_RUNTIME.md"
changelog:
  - 2026-02-27 (rev 3): Protocol V1 E2E підтверджений. Всі кроки 1-12 ✅ LIVE. /lease → /dispatch. Видалено секцію "Що розблоковує реєстрація worker" — вже розблоковано.
  - 2026-02-25 (rev 2): Оновлено до поточного стану — PostgreSQL, auth, membridge proxy, UI. Перекладено українською.
title: "Верифікація шляху виконання BLOOM Runtime"
dg-publish: true
---

# BLOOM Runtime — Верифікація шляху виконання

> Створено: 2026-02-25
> Оновлено: 2026-02-27
> Статус: Canonical
> Layer: Runtime Operations
> Authority: Production Environment
> Scope: Фактичний верифікований шлях виконання — Protocol V1 E2E підтверджений 2026-02-27

---

## Огляд

Цей документ простежує повний шлях виконання BLOOM Runtime та позначає кожний сегмент фактичним верифікованим статусом.

**Позначення:**
- ✅ `LIVE` — верифіковано на production
- ⚙️ `РЕАЛІЗОВАНО` — код існує, логіка правильна, але ще не активовано (відсутня передумова)
- ❌ `ВІДСУТНЄ` — ще не побудовано

---

## Повний шлях виконання

```
Запит клієнта
     │
     ▼
 [1] nginx :80  ──────────────────────────── ✅ LIVE
     │
     ▼
 [2] bloom-runtime :5000 (Express)  ───────── ✅ LIVE
     │
     ├─► X-Runtime-API-Key middleware ─────── ✅ LIVE (опціонально через RUNTIME_API_KEY)
     │
     ├─► /api/membridge/* proxy ──────────── ✅ LIVE (проксі до Membridge :8000)
     │
     ├─► POST /api/runtime/llm-tasks ──────── ✅ LIVE (персистовано в PostgreSQL)
     │
     ▼
 [3] Черга завдань (PostgreSQL) ─────────────── ✅ LIVE (переживає рестарт)
     │
     ▼
 [4] POST /api/runtime/llm-tasks/:id/dispatch
     │   Вибір worker (pickWorker) ──────────── ✅ LIVE (workers online, auto-sync)
     │
     ▼
 [5] Worker auto-sync (інтервал 10с) ──────── ✅ LIVE (→ membridge /agents)
     │
     ├─► membridgeFetch з retry ─────────────── ✅ LIVE (backoff, timeout, tracking)
     │
     ▼
 [6] Membridge control plane :8000 ──────────── ✅ LIVE
     │
     ▼
 [7] Worker Node "alpine" (node-agent :8001) ── ✅ LIVE (зареєстрований, online)
     │
     ├─► POST .../heartbeat (кожні 10с) ──────── ✅ LIVE
     │
     ▼
 [8] Виконання Claude CLI ────────────────────── ✅ LIVE (E2E підтверджено 2026-02-27)
     │
     ▼
 [9] POST .../complete
     │   Створення артефакту ──────────────────── ✅ LIVE
     │   Запис результату ─────────────────────── ✅ LIVE
     │
     ▼
[10] Сховище артефактів (PostgreSQL) ──────────── ✅ LIVE (персистоване)
     │
     ▼
[11] Audit log (PostgreSQL) ───────────────────── ✅ LIVE (персистований)
     │
     ▼
[12] Відповідь клієнту ────────────────────────── ✅ LIVE
```

---

## Посегментна верифікація

### [1] nginx → bloom-runtime

**Статус:** ✅ LIVE

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/
# → 200

curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80/api/runtime/stats
# → 200
```

Конфігурація nginx: `/etc/nginx/http.d/bloom-runtime.conf`
Upstream: `server 127.0.0.1:5000; keepalive 32;`
Заголовки: `X-Real-IP`, `X-Forwarded-For`, підтримка WebSocket upgrade.

---

### [2] bloom-runtime Express

**Статус:** ✅ LIVE

```bash
curl -s http://127.0.0.1:5000/api/runtime/health
# → {"status":"ok","service":"bloom-runtime","storage":"postgresql",...}
```

Node.js 23, Express 5. Обслуговує React SPA (`dist/public/`) + API (`/api/runtime/*`, `/api/membridge/*`).

**Аутентифікація:**
- `X-Runtime-API-Key` — для всіх `/api/runtime/*` та `/api/membridge/*`
- Якщо `RUNTIME_API_KEY` не встановлений — auth вимкнений (режим розробки)
- Незахищені: `/api/runtime/health`, `/api/runtime/test-connection`

---

### [3] Створення завдання

**Статус:** ✅ LIVE (PostgreSQL)

`POST /api/runtime/llm-tasks` створює завдання у PostgreSQL.
Валідація через Zod (`insertLLMTaskSchema`).
Завдання створюється зі статусом `queued`, записується в audit log.

---

### [4] Dispatch та вибір worker

**Статус:** ✅ LIVE

`POST /api/runtime/llm-tasks/:id/dispatch` викликає `pickWorker()`, а потім надсилає DispatchEnvelope на `worker.url/execute-task`:

```
Алгоритм pickWorker():
┌───────────────────────────────────────────┐
│ 1. Фільтр: status="online"               │
│    AND capabilities.claude_cli=true       │
│    AND active_leases < max_concurrency    │
├───────────────────────────────────────────┤
│ 2. Якщо є context_id → sticky routing    │
│    до існуючого worker для цього контексту│
├───────────────────────────────────────────┤
│ 3. Sort: free_slots DESC →               │
│    last_heartbeat DESC                   │
├───────────────────────────────────────────┤
│ 4. Якщо workers = 0 → return null         │
│    → HTTP 503 "No available worker"       │
└───────────────────────────────────────────┘
```

Dispatch Envelope: `{task_id, prompt, context_id, agent_slug, policy, runtime_url}`.
Worker відповідає `{ok: true, started: true}` — виконання у фоні.

---

### [5] Membridge control plane

**Статус:** ✅ LIVE

```bash
curl -s http://127.0.0.1:8000/health
# → {"status":"ok","service":"membridge-control-plane","version":"0.4.0"}
```

Auto-sync workers з Membridge кожні 10 секунд через `workerSync.ts`.
Worker "alpine" зареєстрований у `/agents`, синхронізується до bloom-runtime з `status: "online"`.

---

### [6] Worker Node

**Статус:** ✅ LIVE

Worker "alpine" (node-agent `packages/node-agent`) зареєстрований у Membridge та bloom-runtime.

```bash
GET /api/runtime/workers
# → [{"id":"alpine","status":"online","capabilities":{"claude_cli":true,...}}]
```

Агент запущений як `membridge-agent` (OpenRC) на порту `:8001`.

---

### [7–8] Виконання Claude CLI

**Статус:** ✅ LIVE (E2E підтверджено 2026-02-27)

`POST worker.url/execute-task` приймає DispatchEnvelope і негайно повертає `{ok: true, started: true}`.
У фоні:
- Heartbeat thread: `POST runtime_url/llm-tasks/{id}/heartbeat` кожні 10с
- Виконання `claude --prompt "..."` з timeout
- `POST runtime_url/llm-tasks/{id}/complete` по завершенню

E2E тест верифікований:
```bash
# Task completed, artifact: "HELLO BLOOM"
# Heartbeat logs: 3x POST .../heartbeat 200 OK (кожні 10с)
```

---

### [9] Завершення завдання

**Статус:** ✅ LIVE

`POST /api/runtime/llm-tasks/:id/complete`:

```
1. Валідація тіла (Zod: completeTaskSchema)
       │
2. Створення артефакту в PostgreSQL
       │
3. Запис результату (status, output, error_message, metrics)
       │
4. Оновлення статусу завдання → "completed" або "failed"
       │
5. Звільнення lease (status = "released"), зменшення active_leases
       │
6. Запис в audit log
```

---

### [10–11] Сховище артефактів та Audit log

**Статус:** ✅ LIVE (PostgreSQL)

- Артефакти зберігаються в `runtime_artifacts` (PostgreSQL)
- Audit log у `audit_logs` (PostgreSQL)
- Обидва переживають рестарти сервісу
- Запитуються через `GET /api/runtime/artifacts` та `GET /api/runtime/audit`

---

### [12] Відповідь клієнту

**Статус:** ✅ LIVE

Всі API відповіді — JSON. Логування запитів: `METHOD /path STATUS DURATIONms`.

---

## Зведена таблиця

| Крок | Компонент | Статус | Примітки |
|------|-----------|--------|----------|
| 1 | nginx reverse proxy | ✅ LIVE | — |
| 2 | bloom-runtime Express | ✅ LIVE | — |
| 3 | Створення завдання | ✅ LIVE | PostgreSQL |
| 4 | Dispatch / вибір worker | ✅ LIVE | POST .../dispatch |
| 5 | Membridge control plane | ✅ LIVE | Worker sync 10s |
| 6 | Worker node "alpine" | ✅ LIVE | node-agent :8001 |
| 7–8 | Виконання Claude CLI | ✅ LIVE | Async + heartbeat |
| 9 | Завершення + артефакт | ✅ LIVE | Atomic transaction |
| 10 | Сховище артефактів | ✅ LIVE | PostgreSQL |
| 11 | Audit log | ✅ LIVE | PostgreSQL |
| 12 | API відповідь | ✅ LIVE | — |

**Protocol V1 E2E підтверджений 2026-02-27. Всі кроки LIVE.**

---

## Membridge Proxy

Окрім Runtime API, доступні proxy-маршрути до Membridge Control Plane:

| Метод | Шлях | Проксує до | Статус |
|-------|------|-----------|--------|
| `GET` | `/api/membridge/health` | `/health` | ✅ LIVE |
| `GET` | `/api/membridge/projects` | `/projects` | ✅ LIVE |
| `GET` | `/api/membridge/projects/:cid/leadership` | `/projects/{cid}/leadership` | ✅ LIVE |
| `GET` | `/api/membridge/projects/:cid/nodes` | `/projects/{cid}/nodes` | ✅ LIVE |
| `POST` | `/api/membridge/projects/:cid/leadership/select` | `/projects/{cid}/leadership/select` | ✅ LIVE |

Всі маршрути використовують `membridgeFetch()` — admin key інжектується серверним кодом.
Фронтенд: вкладка **Membridge** у навігації.

---

## Семантичні зв'язки

**Цей документ залежить від:**
- [[СТАН_РОЗГОРТАННЯ_RUNTIME_ALPINE.md]] — топологія та стан сервісів
- [[../../architecture/runtime/ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI.md]] — специфікація Claude CLI proxy

**На цей документ посилаються:**
- [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME.md]] — прогалини та наступні кроки
- [[../../ІНДЕКС.md]] — головний індекс
