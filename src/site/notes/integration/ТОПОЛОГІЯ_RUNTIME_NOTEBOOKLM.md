---
tags:
  - domain:arch
  - status:canonical
  - format:spec
created: 2026-02-24
updated: 2026-02-27
legacy_name: "ТОПОЛОГІЯ_RUNTIME_NOTEBOOKLM.md"
tier: 1
title: "Топологія BLOOM Runtime: NotebookLM"
dg-publish: true
---

# Runtime Topology: BLOOM System

> Created: 2026-02-24
> Updated: 2026-02-27 (Protocol V1 confirmed E2E)
> Author: architect
> Status: canonical
> Мова: Ukrainian (canonical)

---

## 0. Призначення

Визначає повну runtime-топологію системи Garden Bloom: вузли, сервіси, порти, мережеві зони, trust boundaries та потік даних між компонентами.

Цей документ є операційною картою системи. Будь-які зміни у топології (нові вузли, зміна портів, зміна trust boundary) вимагають оновлення цього документу.

**Статус:** Protocol V1 підтверджений повним E2E тестом (2026-02-27).

---

## 1. Node Inventory (Інвентар вузлів)

| Node | Тип | IP / Host | Зовнішня адреса | Роль |
|------|-----|-----------|-----------------|------|
| `alpine` | Control plane (x86_64) | `192.168.3.184` | `bloom.exodus.pp.ua` (Cloudflare Tunnel) | BLOOM Runtime + Membridge Server + Agent; Primary node |
| `rpi` | Edge (ARM64 RPi 3B) | `192.168.3.x` | — | Membridge Agent; Secondary node |
| `orange` | Edge (ARM64 Orange Pi PC2) | `192.168.3.x` | — | Membridge Agent; Secondary node |
| `lovable-fe` | Cloud SPA | `bloom-forge-scaffold.lovable.app` | — | Frontend (React) |
| `minio` | Storage | `apiminio.exodus.pp.ua` | HTTPS | Object storage (canonical) |
| `github` | Git hosting | `github.com` | — | Source code + `garden-bloom-memory` monorepo |

---

## 2. Service-to-Node Mapping (Сервіси по вузлах)

### 2.1 Alpine (192.168.3.184 / bloom.exodus.pp.ua) — Control Plane

| Сервіс | Порт | Init | Опис |
|--------|------|------|------|
| `bloom-runtime` | `5000` | systemd | **BLOOM Runtime** — Express API + React SPA; оркестратор задач |
| `membridge-server` | `8000` | OpenRC | Membridge Control Plane API + Web UI |
| `membridge-agent` | `8001` | OpenRC | Membridge Agent; heartbeat sender; **Claude CLI executor** |
| `cloudflared` | — | systemd | Cloudflare Tunnel → bloom.exodus.pp.ua → localhost:5000 |
| `claude-mem-worker` | `37777` | rc | Claude CLI memory worker |

### 2.2 RPi 3B / Orange Pi PC2 — Edge Nodes

| Сервіс | Порт | Init | Опис |
|--------|------|------|------|
| `membridge-agent` | `8001` | OpenRC | Agent; heartbeat + Claude CLI executor |
| `claude-mem-worker` | `37777` | rc | Claude CLI memory worker |

### 2.3 Lovable (Cloud)

| Сервіс | Тип | Опис |
|--------|-----|------|
| `lovable-frontend` | React SPA | Projection layer; polling Runtime API |

---

## 3. Port Matrix (Матриця портів)

| Порт | Вузол | Сервіс | Auth | Scope |
|------|-------|--------|------|-------|
| `5000` | Alpine | bloom-runtime (Express) | `X-Runtime-API-Key` | LAN + Cloudflare Tunnel (public) |
| `8000` | Alpine | membridge-server | `X-MEMBRIDGE-ADMIN` | LAN + internal |
| `8001` | Alpine, RPi, Orange | membridge-agent | localhost exempt / `X-MEMBRIDGE-AGENT` | LAN |
| `37777` | Alpine, RPi, Orange | claude-mem-worker | none (localhost only) | localhost |

**Зовнішній доступ:** `bloom.exodus.pp.ua` → Cloudflare Tunnel → `localhost:5000` (Alpine).
Без цього тунелю Lovable Frontend не може звертатися до Runtime API.

---

## 4. Trust Boundaries (Межі довіри)

```
╔══════════════════════════════════════════════════════════════╗
║  ZONE: Public Internet                                       ║
║                                                              ║
║   [Lovable Frontend]──HTTPS──►[Cloudflare Tunnel]            ║
║   bloom-forge-scaffold.lovable.app   bloom.exodus.pp.ua      ║
║                                        │                     ║
╠════════════════════════ZONE: Cloudflare Tunnel═══════════════╣
║                                        │                     ║
║                              localhost:5000                   ║
║                                        │                     ║
╠════════════════════════ZONE: Alpine Host══════════════════════╣
║                                        │                     ║
║   ┌────────────────────────────────────▼─────────────────┐   ║
║   │         BLOOM Runtime (Express :5000)                 │   ║
║   │  ┌──────────────┐   ┌────────────────────────────┐   │   ║
║   │  │ /api/runtime  │   │ /api/membridge (proxy)     │   │   ║
║   │  │ tasks,workers │   │ → localhost:8000            │   │   ║
║   │  │ leases,audit  │   └────────────────────────────┘   │   ║
║   │  └──────┬───────┘                                     │   ║
║   │         │ dispatch: POST worker:8001/execute-task      │   ║
║   └─────────┼─────────────────────────────────────────────┘   ║
║             │                                                 ║
║   ┌─────────▼───────────────────────────────────────────┐     ║
║   │  Membridge Control Plane (:8000)                     │    ║
║   │  agents, projects, leadership, heartbeat registry    │    ║
║   └──────────────────────────────────────────────────────┘    ║
║                                                               ║
╠═══════════════════ZONE: Private LAN (192.168.3.0/24)═════════╣
║                                                               ║
║   [Alpine :8001] ← Claude CLI executor (agent)               ║
║   [RPi :8001] ──heartbeat──► [Alpine :8000]                   ║
║   [Orange :8001] ─heartbeat─► [Alpine :8000]                  ║
║                                                               ║
║   All agents ──heartbeat──► BLOOM Runtime :5000               ║
║   All agents ──results────► BLOOM Runtime :5000               ║
║                                                               ║
║   All nodes ──MinIO sync──► [MinIO] (S3 over HTTPS)           ║
╚══════════════════════════════════════════════════════════════╝
```

**Правила перетину меж:**

1. Frontend → Runtime: завжди через Cloudflare Tunnel (HTTPS); `X-Runtime-API-Key` header.
2. Runtime → Membridge CP: localhost HTTP; `X-MEMBRIDGE-ADMIN` header.
3. Runtime → Worker Agents: LAN HTTP; dispatch envelope до `:8001/execute-task`.
4. Worker → Runtime: LAN HTTP; heartbeat + complete callbacks до `:5000/api/runtime/`.
5. LAN nodes → MinIO: S3 over HTTPS; credentials у `.env.agent` (не в VCS).

---

## 5. Data Flow Diagram (Потік даних)

### 5.1 Protocol V1: LLM Task Execution (ПІДТВЕРДЖЕНИЙ)

```
Owner / Frontend
  │ POST /api/runtime/llm-tasks
  ▼
BLOOM Runtime (Express :5000)
  │ створити task (status: queued)
  │
  │ POST /api/runtime/llm-tasks/:id/dispatch
  │   1. pickWorker() — filter online, claude_cli, free slots
  │   2. створити lease (TTL = timeout_sec + 30)
  │   3. POST worker:8001/execute-task (DispatchEnvelope)
  ▼
Membridge Agent (:8001)
  │ 1. Негайно: {"ok": true, "started": true}
  │ 2. Background: запустити Claude CLI
  │ 3. Background: heartbeat loop кожні 10с
  │    POST runtime:5000/api/runtime/llm-tasks/:id/heartbeat
  │
  │ ... Claude CLI працює ...
  │
  │ 4. POST runtime:5000/api/runtime/llm-tasks/:id/complete
  │    { output, metrics, status: "success" }
  ▼
BLOOM Runtime
  │ створити artifact (атомарно з status=completed)
  │ записати audit log
  ▼
Frontend polls → отримує completed task + artifact
```

### 5.2 Lease Reaper (фонова задача)

```
BLOOM Runtime (кожні 15с):
  1. Знайти leases де expires_at < now
  2. Для кожного:
     ├── lease.status = "expired"
     ├── task.attempts < max?
     │   YES → task.status = "queued" (requeue)
     │   NO  → task.status = "dead"
     └── audit_log.insert(lease_expired, actor: reaper)
```

### 5.3 Worker Sync (автосинхронізація)

```
BLOOM Runtime (кожні 10с):
  1. GET localhost:8000/agents (Membridge CP)
  2. Для кожного агента з heartbeat:
     ├── Upsert worker в PostgreSQL
     ├── status = "online" (якщо heartbeat < 60с)
     └── status = "offline" (інакше)
```

### 5.4 Memory Sync Flow (Membridge claude-mem.db)

```
Claude CLI session (Alpine/RPi/Orange)
  │ writes to claude-mem.db (local SQLite)
  │
  ▼ (on session Stop hook)
hooks/claude-mem-hook-push
  │ check leadership (primary?) → MinIO: lease.json
  │ VACUUM INTO snapshot
  │ upload db + sha256 → MinIO
  │
  ▼ (on session Start hook)
hooks/claude-mem-hook-pull
  │ compare sha256 → MinIO
  │ download + replace local db
```

---

## 6. Network Zones (Мережеві зони)

| Зона | Компоненти | Протокол | Auth |
|------|-----------|---------|------|
| Public Internet | Lovable SPA, Cloudflare Tunnel | HTTPS | X-Runtime-API-Key |
| Alpine Host | Runtime, Membridge CP, Cloudflared | HTTP (localhost) | Internal headers |
| Private LAN | Alpine, RPi, Orange (agents) | HTTP (LAN) | Agent key / none |
| Localhost | claude-mem-worker, hooks | HTTP 127.0.0.1 | none |
| External Storage | MinIO (apiminio.exodus.pp.ua) | HTTPS/S3 | S3 keys |

---

## 7. Failure Modes (Топологічний рівень)

| Сценарій | Вплив | Ізоляція |
|----------|-------|----------|
| Cloudflare Tunnel offline | Frontend не може дістатися Runtime | LAN nodes продовжують працювати; задачі виконуються |
| Alpine offline | Runtime + CP + Tunnel недоступні | RPi/Orange зберігають local DB; heartbeat зупиняється |
| MinIO недоступний | Push/pull fail; artifacts лише в PostgreSQL | Claude CLI sessions продовжуються; local DB незмінна |
| RPi/Orange offline | Менше workers для dispatch | Runtime використовує доступні ноди |
| PostgreSQL недоступний | Runtime не стартує | Критична відмова; потребує відновлення DB |
| Lease expired (worker зависає) | Reaper → requeue або dead | Автоматичне відновлення (Protocol V1) |

---

## Semantic Relations

**Цей документ є частиною:**
- [[_INDEX]] — Integration Layer, індекс пакету

**Залежить від:**
- [[АРХІТЕКТУРНИЙ_КОРІНЬ]] — A1, A5; визначають топологічні constraints
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI]] — Protocol V1 деталі

**На цей документ посилаються:**
- [[ІНТЕГРАЦІЯ_MEMBRIDGE]] — Alpine :8000/:8001 деталі
- [[ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] — Lovable як projection node
- [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] — bundle для інтеграції
