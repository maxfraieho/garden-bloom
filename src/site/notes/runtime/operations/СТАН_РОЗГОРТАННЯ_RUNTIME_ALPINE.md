---
tags:
  - domain:runtime
  - status:canonical
  - layer:operations
  - authority:production
created: 2026-02-25
updated: 2026-02-27
legacy_name: "СТАН_РОЗГОРТАННЯ_RUNTIME_ALPINE.md"
changelog:
  - 2026-02-28 (rev 5): Додано auto-sync MEMBRIDGE_ADMIN_KEY + MEMBRIDGE_AGENT_KEY. Signal decoding для exit codes. run-agent.sh як canonical entry point.
  - 2026-02-27 (rev 4): Виправлено OpenRC restart — додана кастомна stop() функція в /etc/init.d/bloom-runtime. Коренева причина: start-stop-daemon не міг матчити процес /usr/bin/node через wrapper-скрипт з exec. rc-service restart тепер працює без помилок.
  - 2026-02-27 (rev 3): Protocol V1 E2E. Порт 8001 = node-agent (packages/node-agent). Workers зареєстровані, online. Додано Cloudflare Tunnel. TLS через Cloudflare. Lease reaper 15s. Оновлено Operational Readiness.
  - 2026-02-25 (rev 2): GAP-1 (persistence) and GAP-2 (auth) resolved by Lovable commit 150b491
title: "Стан розгортання BLOOM Runtime — Alpine"
dg-publish: true
---

# BLOOM Runtime — Deployment State (Alpine Linux)

> Створено: 2026-02-25
> Оновлено: 2026-02-27
> Статус: Canonical
> Layer: Runtime Operations
> Authority: Production Environment
> Scope: Actual deployed runtime state on Alpine Linux server — Protocol V1 E2E verified

---

## A. System Topology

```
┌─────────────────────────────────────────────────────────┐
│                   External clients                       │
│              (browser, curl, API consumers)             │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTPS (bloom.exodus.pp.ua)
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare Tunnel (cloudflared)            │
│         bloom.exodus.pp.ua → localhost:5000             │
│         TLS терміновано на Cloudflare edge              │
└───────────────────────┬─────────────────────────────────┘
                        │ HTTP :80 (also direct local)
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 nginx 1.28.2                            │
│           reverse proxy / default_server                │
│         /etc/nginx/http.d/bloom-runtime.conf            │
└───────────────────────┬─────────────────────────────────┘
                        │ proxy_pass :5000
                        ▼
┌─────────────────────────────────────────────────────────┐
│              bloom-runtime (Node.js 23)                 │
│         Express 5 backend + Vite 7 React frontend       │
│                   :5000 (0.0.0.0)                       │
│           /home/vokov/membridge/dist/index.cjs           │
│                                                         │
│  ┌─────────────────┐   ┌──────────────────────────┐    │
│  │  React 18 SPA   │   │   /api/runtime/*  routes  │    │
│  │  (served from   │   │   (Express 5 handlers)   │    │
│  │   dist/public/) │   │                          │    │
│  └─────────────────┘   └──────────┬───────────────┘    │
│                                   │ membridgeFetch()    │
│  ┌───────────────────────────────────────────────────┐  │
│  │   runtimeAuthMiddleware (X-RUNTIME-API-KEY)       │  │
│  └──────────────────────┬────────────────────────────┘  │
│                         │                               │
│  ┌──────────────────────▼────────────────────────────┐  │
│  │       DatabaseStorage (PostgreSQL via Drizzle)     │  │
│  │  tasks / leases / workers / artifacts / audit      │  │
│  │  runtime_settings (persistent config)              │  │
│  └───────────────────────────────────────────────────┘  │
└───────────────┬──────────────────┬──────────────────────┘
                │                  │
                │ HTTP :8000       │ HTTP :8001
                ▼                  ▼
┌───────────────────────┐ ┌────────────────────────────────┐
│  membridge control    │ │    node-agent (Python/FastAPI) │
│  plane v0.4.0         │ │    packages/node-agent         │
│  Python / FastAPI     │ │    :8001 (0.0.0.0)             │
│  :8000 (0.0.0.0)      │ │    /execute-task               │
│  /agents, /projects   │ │    /health                     │
└───────────────────────┘ │    OpenRC: membridge-agent     │
                          └────────────┬───────────────────┘
                                       │ executes
                                       ▼
                          ┌────────────────────────────────┐
                          │    Claude CLI                  │
                          │    (claude binary)             │
                          │    Worker "alpine" — ONLINE    │
                          └────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│              PostgreSQL :5432 (локальний)                │
│    bloom_runtime database (Drizzle ORM)                 │
│    8 tables: llm_tasks, leases, workers,                │
│    runtime_artifacts, llm_results, audit_logs,          │
│    runtime_settings, users                              │
│    connected via DATABASE_URL в /etc/bloom-runtime.env  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   MinIO :9000                           │
│            object storage (separate service)            │
│     connected via membridge memory sync (SQLite→S3)     │
└─────────────────────────────────────────────────────────┘
```

### Port Map

| Port | Service | Role | Status |
|------|---------|------|--------|
| 443 | Cloudflare Tunnel (cloudflared) | HTTPS → localhost:5000 (bloom.exodus.pp.ua) | Running |
| 80 | nginx 1.28.2 | Reverse proxy → :5000 | Running |
| 5000 | bloom-runtime | Express API + React SPA | Running |
| 8000 | membridge control plane | Worker registry, agent coordination | Running |
| 8001 | node-agent (packages/node-agent) | Claude CLI executor (Protocol V1) | Running |
| 5432 | PostgreSQL | bloom_runtime database (локальний) | Running |
| 9000 | MinIO | Object storage | Running |
| 22 | sshd | SSH access | Running |

---

## B. Runtime Services

### bloom-runtime (OpenRC)

**Init script:** `/etc/init.d/bloom-runtime`

```ini
command        = /usr/local/bin/bloom-runtime-start   # wrapper: set -a; . /etc/bloom-runtime.env; exec /usr/bin/node dist/index.cjs
command_user   = vokov:vokov
command_background = true
pidfile        = /run/bloom-runtime.pid
directory      = /home/vokov/membridge
envfile        = /etc/bloom-runtime.env
output_log     = /var/log/bloom-runtime.log
error_log      = /var/log/bloom-runtime-error.log
runlevel       = default
```

> **Важливо:** init-скрипт містить кастомну `stop()` функцію. Стандартний `start-stop-daemon --stop --exec bloom-runtime-start` не матчить фактичний процес `/usr/bin/node` (через `exec` у wrapper-скрипті), тому OpenRC повертав `ERROR: stopped by something else` і не зупиняв процес. Кастомна `stop()` вбиває процес напряму через `kill $(cat $pidfile)`.

### membridge-agent (OpenRC)

**Init script:** `/etc/init.d/membridge-agent`
**Launch script:** `/home/vokov/membridge/run-agent.sh`
**Env file:** `/home/vokov/membridge/.env.agent`

```ini
command        = /home/vokov/membridge/run-agent.sh
command_user   = vokov:vokov
output_log     = /var/log/membridge-agent.log
error_log      = /var/log/membridge-agent-error.log
runlevel       = default
```

### Environment Variables

**bloom-runtime:** `/etc/bloom-runtime.env` (chmod 600, не в git)

| Variable | Purpose | Example value |
|----------|---------|---------------|
| `NODE_ENV` | Runtime mode | `production` |
| `PORT` | Listening port | `5000` |
| `MEMBRIDGE_SERVER_URL` | Membridge control plane URL | `http://127.0.0.1:8000` |
| `MEMBRIDGE_ADMIN_KEY` | Admin auth key for membridge | `<secret, never logged>` |
| `MEMBRIDGE_AGENT_KEY` | Key for dispatching to node-agent | `<secret>` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://bloom:pass@127.0.0.1:5432/bloom_runtime` |
| `RUNTIME_API_KEY` | API key for `/api/runtime/*` routes | `<secret>` (optional) |

**node-agent:** `/home/vokov/membridge/.env.agent` (не в git)

| Variable | Purpose |
|----------|---------|
| `MEMBRIDGE_AGENT_KEY` | Auth key (X-MEMBRIDGE-AGENT) — **auto-synced from Runtime** |
| `MEMBRIDGE_ADMIN_KEY` | Admin key для heartbeat до CP — **auto-synced from Runtime** |
| `MEMBRIDGE_NODE_ID` | Node identifier (`alpine`) |
| `BLOOM_RUNTIME_URL` | BLOOM Runtime URL для callbacks |
| `MEMBRIDGE_SERVER_ADMIN_KEY` | (legacy fallback, replaced by MEMBRIDGE_ADMIN_KEY auto-sync) |

### Working Directory & Paths

| Path | Content |
|------|---------|
| `/home/vokov/membridge/` | Repository root |
| `/home/vokov/membridge/dist/index.cjs` | Production server bundle (esbuild) |
| `/home/vokov/membridge/dist/public/` | React SPA static assets (Vite build) |
| `/home/vokov/membridge/agent/main.py` | node-agent source (packages/node-agent) |
| `/etc/bloom-runtime.env` | Production secrets bloom-runtime (chmod 600) |
| `/home/vokov/membridge/.env.agent` | Production secrets node-agent (не в git) |
| `/var/log/bloom-runtime.log` | stdout (access, request logs) |
| `/var/log/bloom-runtime-error.log` | stderr (errors, exceptions) |
| `/var/log/membridge-agent.log` | node-agent stdout |
| `/var/log/membridge-agent-error.log` | node-agent stderr |

### Build Artifacts

| File | Size | Purpose |
|------|------|---------|
| `dist/index.cjs` | ~1.1 MB | Server bundle (esbuild, CJS) |
| `dist/public/assets/index-*.js` | ~373 KB (115 KB gzip) | React SPA bundle (Vite) |
| `dist/public/assets/index-*.css` | ~70 KB (11 KB gzip) | Tailwind CSS bundle |

### Operational Commands

```bash
# Manage bloom-runtime service
sudo rc-service bloom-runtime start|stop|restart|status

# Manage node-agent service
sudo rc-service membridge-agent start|stop|restart|status

# Rebuild and restart (after code changes)
cd /home/vokov/membridge
npm run build
sudo rc-service bloom-runtime restart

# Logs
sudo tail -f /var/log/bloom-runtime.log
sudo tail -f /var/log/bloom-runtime-error.log
sudo tail -f /var/log/membridge-agent-error.log

# nginx
sudo nginx -t && sudo nginx -s reload
```

---

## C. Runtime API State

Base path: `/api/runtime/`
Served by: bloom-runtime on `:5000` (via nginx `:80`, via Cloudflare `bloom.exodus.pp.ua`)
Auth: `X-RUNTIME-API-KEY` header middleware (if `RUNTIME_API_KEY` env var set)

### Endpoints — Full List

| Method | Path | Status | Returns (current state) |
|--------|------|--------|------------------------|
| `GET` | `/api/runtime/config` | ✅ 200 | `{membridge_server_url, admin_key_masked, connected, last_test}` |
| `POST` | `/api/runtime/config` | ✅ 200 | Updated config (Zod-validated body) |
| `POST` | `/api/runtime/test-connection` | ✅ 200 | `{connected: true, health: {...}}` |
| `GET` | `/api/runtime/workers` | ✅ 200 | `[{id:"alpine", status:"online", ...}]` |
| `POST` | `/api/runtime/workers` | ✅ 201/200 | Worker registration/update |
| `GET` | `/api/runtime/workers/:id` | ✅ 200 | Worker detail + active leases |
| `GET` | `/api/runtime/workers/:id/agent-health` | ✅ live | Health check агента |
| `POST` | `/api/runtime/llm-tasks` | ✅ 201 | Creates task in queue |
| `GET` | `/api/runtime/llm-tasks` | ✅ 200 | Task queue list |
| `GET` | `/api/runtime/llm-tasks/:id` | ✅ 200 | Task detail |
| `POST` | `/api/runtime/llm-tasks/:id/dispatch` | ✅ 200 | Dispatches to worker |
| `POST` | `/api/runtime/llm-tasks/:id/heartbeat` | ✅ 200 | Renews lease TTL → status "running" |
| `POST` | `/api/runtime/llm-tasks/:id/complete` | ✅ 200 | Writes artifact + result |
| `POST` | `/api/runtime/llm-tasks/:id/requeue` | ✅ 200 | Requeues failed/dead tasks |
| `GET` | `/api/runtime/leases` | ✅ 200 | Active leases |
| `GET` | `/api/runtime/runs` | ✅ 200 | Last 50 tasks |
| `GET` | `/api/runtime/artifacts` | ✅ 200 | Artifacts (query: `?task_id=`) |
| `GET` | `/api/runtime/audit` | ✅ 200 | Recent audit log entries |
| `GET` | `/api/runtime/stats` | ✅ 200 | `{tasks, leases, workers}` summary |
| `GET` | `/api/runtime/health` | ✅ 200 | Health + membridge connection state |
| `GET` | `/api/runtime/agent-install-script` | ✅ 200 | Bash one-liner install script |

### Task Lifecycle (Protocol V1)

```
queued → [POST .../dispatch] → leased → [POST .../heartbeat] → running → [POST .../complete] → completed
                                                                                              ↘ failed
                                                                         [reaper 15s] → dead (if max_attempts exceeded)
```

Lease Reaper: `setInterval` **15 секунд**, expired leases → requeue або dead + audit log.
Lease TTL default: **300 секунд**.

### Worker Selection Algorithm

`pickWorker()` (Protocol V1 §5):
1. Фільтр: `status === "online"` AND `capabilities.claude_cli === true` AND `active_leases < max_concurrency`
2. Sticky: якщо є `context_id` → prefer worker з тим самим context_id
3. Sort: `free_slots DESC` → `last_heartbeat DESC`

---

## D. Membridge Integration State

### Connection Status

```json
{
  "connected": true,
  "health": {
    "status": "ok",
    "service": "membridge-control-plane",
    "version": "0.4.0",
    "projects": 1,
    "agents": 1
  }
}
```

### Worker Sync

| Component | State |
|-----------|-------|
| membridge `/health` endpoint | ✅ reachable, responding |
| `X-MEMBRIDGE-ADMIN` auth | ✅ key loaded from env, injected in requests |
| membridge `/agents` endpoint | ✅ worker "alpine" registered |
| Worker "alpine" status | ✅ online (auto-sync 10s) |
| Task execution pipeline | ✅ LIVE (E2E verified 2026-02-27) |
| Dispatch / Lease assignment | ✅ LIVE |

### Leasing Protocol (LIVE)

```
queued → [POST .../dispatch] → leased → [POST .../heartbeat] → running → [POST .../complete] → completed
                                                                                              ↘ failed
```

---

## E. Storage Model

### Current Implementation: DatabaseStorage ✅ (resolved 2026-02-25)

Class: `DatabaseStorage` in `server/storage.ts`
Driver: Drizzle ORM + `@neondatabase/serverless` (PostgreSQL)
Persistence: **full** — all data written to PostgreSQL

### Consequences of PostgreSQL Storage

| Event | Consequence |
|-------|-------------|
| `rc-service bloom-runtime restart` | State **preserved** in PostgreSQL |
| Server crash | State preserved; in-flight runs recovered via lease expiry |
| Machine reboot | Service auto-restarts (OpenRC default), state **intact** |

---

## F. Security State

### Runtime API

| Control | Status | Notes |
|---------|--------|-------|
| Authentication on `/api/runtime/*` | ✅ **present** | `X-RUNTIME-API-KEY` header, timing-safe comparison |
| Rate limiting | ✅ **present** | 100 req/хв (загальний), 20 req/хв (test-connection) |
| Input validation | ✅ Present | Zod schemas on POST bodies |
| Admin key in logs | ✅ Masked | Returns `xxxx****xxxx` in API responses |
| Admin key in git | ✅ Safe | `/etc/bloom-runtime.env` is outside repo |

### Network / Transport

| Control | Status | Notes |
|---------|--------|-------|
| TLS / HTTPS (зовнішній) | ✅ **активний** | Cloudflare Tunnel → bloom.exodus.pp.ua (Cloudflare edge TLS) |
| nginx ↔ bloom-runtime | HTTP only | localhost proxy, TLS не потрібен |
| bloom-runtime ↔ membridge | HTTP only | loopback `127.0.0.1:8000` |
| bloom-runtime ↔ node-agent | HTTP only | loopback `127.0.0.1:8001` |

### Secret Management

- `/etc/bloom-runtime.env`: `chmod 600`, owned by root
- `/home/vokov/membridge/.env.agent`: не в git, містить agent key і runtime URL
- `MEMBRIDGE_ADMIN_KEY`: never written to logs; masked in API responses

---

## G. Membridge Control Plane Proxy

BLOOM Runtime проксує Membridge Control Plane через `/api/membridge/*`:

| Метод | Шлях | Проксує до | Статус |
|-------|------|-----------|--------|
| `GET` | `/api/membridge/health` | `/health` | ✅ Працює |
| `GET` | `/api/membridge/projects` | `/projects` | ✅ Працює |
| `GET` | `/api/membridge/projects/:cid/leadership` | `/projects/{cid}/leadership` | ✅ Працює |
| `GET` | `/api/membridge/projects/:cid/nodes` | `/projects/{cid}/nodes` | ✅ Працює |
| `POST` | `/api/membridge/projects/:cid/leadership/select` | `/projects/{cid}/leadership/select` | ✅ Працює |

---

## H. Оцінка операційної готовності

| Вимір | Оцінка | Опис |
|-----------|-------|-----------|
| **Архітектурна готовність** | 9/10 | Protocol V1 повністю реалізований. Persistence (PostgreSQL), auth, rate limiting, membridge proxy, Cloudflare TLS. |
| **Готовність виконання** | 9/10 | E2E pipeline підтверджений: create → dispatch → heartbeat → complete → artifact. Worker "alpine" online. |
| **Операційна готовність** | 7/10 | Сервіс автозапускається, логи налаштовані, nginx + cloudflared, секрети захищені. Відсутнє: ротація логів, alerting. |
| **Production готовність** | 9/10 | GAP-1..GAP-7 вирішені. Protocol V1 E2E. HTTPS через Cloudflare. Готовий до production. |

---

## Semantic Relations

**This document depends on:**
- [[../../architecture/runtime/ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI.md]] — architectural spec for Claude CLI proxy
- [[../../integration/ІНТЕГРАЦІЯ_MEMBRIDGE.md]] — Membridge Control Plane contract

**This document is referenced by:**
- [[ВЕРИФІКАЦІЯ_ШЛЯХУ_ВИКОНАННЯ_RUNTIME.md]] — actual execution path trace
- [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME.md]] — gaps and remediation
- [[../../ІНДЕКС.md]] — master index
