---
tags:
  - domain:meta
  - status:canonical
  - format:inventory
created: 2026-02-24
updated: 2026-02-27
tier: 1
title: "Шар інтеграції — Індекс пакету"
dg-publish: true
---

# Integration Layer — Індекс пакету

> Created: 2026-02-24
> Updated: 2026-02-27 (Protocol V1 E2E підтверджений)
> Author: architect
> Status: canonical
> Мова: Ukrainian (canonical)

---

## 0. Призначення

Цей пакет визначає архітектурний шар інтеграції між компонентами системи Garden Bloom:

- **BLOOM Runtime** — Express :5000 на Alpine; оркестратор задач, task queue, lease management
- **Membridge Control Plane** — FastAPI :8000; registry workers, leadership lease, heartbeat
- **Membridge Agent (Worker)** — FastAPI :8001; Claude CLI executor, heartbeat sender
- **Lovable Frontend** — Projection Layer; читає стан через Runtime API
- **MinIO** — canonical object storage для claude-mem.db та артефактів

**Статус:** Protocol V1 (task create → dispatch → async execute → heartbeat → complete → artifact) підтверджений E2E тестом 2026-02-27.

---

## 1. Manifest

| Документ | Домен | Формат | Статус | Призначення |
|----------|-------|--------|--------|-------------|
| [[ТОПОЛОГІЯ_RUNTIME_NOTEBOOKLM]] | `arch` | `spec` | ✅ Актуальний | Вузли, сервіси, порти, trust boundaries, data flow |
| [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] | `integration` | `bundle` | ✅ Актуальний | Повний bundle для Lovable + Runtime + Node Agent |
| [[ІНТЕГРАЦІЯ_MEMBRIDGE]] | `storage` | `contract` | ✅ Актуальний | Leadership, lease, sync, control-plane API, Runtime proxy |
| [[ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] | `frontend` | `spec` | ✅ Актуальний | Projection Layer, Runtime API endpoints, polling |
| [[JOB_QUEUE_ТА_ARTIFACT_MODEL]] | `execution` | `contract` | ⚠️ Частково | State machines, Artifact model (NLM частина — перспективна) |
| [[ПЕРСПЕКТИВА_АГЕНТНОЇ_РОЗРОБКИ]] | `arch` | `spec` | 📋 Roadmap | MCP інтеграція, Unified Memory — стратегія |
| [[ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND]] | `api` | `spec` | 📋 Перспективна | FastAPI NLM Proxy — не реалізовано в Protocol V1 |
| [[ІНТЕГРАЦІЯ_MEMORY_BACKEND]] | `storage` | `spec` | 📋 Перспективна | Mastra + git memory — не реалізовано в Protocol V1 |
| [[АРХІТЕКТУРА_РОЗГОРТАННЯ_REPLIT]] | `arch` | `guide` | 📋 Перспективна | Replit NLM deployment — не реалізовано в Protocol V1 |

---

## 2. Позиція в архітектурі Garden Bloom (актуальна)

```
┌──────────────────────────────────────────────────────────────┐
│                    Garden Bloom System                        │
│                                                              │
│  ┌──────────────┐   HTTPS (Tunnel)   ┌──────────────────┐   │
│  │   Lovable    │◄──────────────────►│  BLOOM Runtime    │   │
│  │  Frontend    │  bloom.exodus.pp.ua│  Express :5000    │   │
│  │  (SPA)       │   (polling)        │  PostgreSQL       │   │
│  └──────────────┘                    └────────┬──────────┘   │
│                                               │              │
│                              ┌────────────────┼────────────┐ │
│                              │  proxy :8000   │ dispatch   │ │
│                              ▼                ▼            │ │
│                   ┌──────────────┐   ┌─────────────────┐   │ │
│                   │  Membridge   │   │  Worker Agents   │   │ │
│                   │  CP :8000    │   │  :8001 (x3)     │   │ │
│                   │  (leadership,│   │  Claude CLI      │   │ │
│                   │   heartbeat) │   │  execute-task    │   │ │
│                   └──────────────┘   └────────┬────────┘   │ │
│                                               │            │ │
│                              heartbeat + results           │ │
│                              → Runtime :5000               │ │
│                                                            │ │
│  ┌───────────────────────────────────────────────────┐     │ │
│  │              MinIO Object Storage                  │     │ │
│  │  (claude-mem.db · artifacts · leadership leases)   │     │ │
│  └───────────────────────────────────────────────────┘     │ │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Залежності між документами

```
_INDEX (цей файл)
├── ТОПОЛОГІЯ_RUNTIME_NOTEBOOKLM        ← читати першим
├── ПАКЕТ_ІНТЕГРАЦІЇ_V1              ← читати другим (практичний guide)
├── ІНТЕГРАЦІЯ_MEMBRIDGE               ← залежить від TOPOLOGY
├── ІНТЕГРАЦІЯ_FRONTEND_LOVABLE        ← залежить від BUNDLE + TOPOLOGY
├── JOB_QUEUE_ТА_ARTIFACT_MODEL        ← state machines (частково перспективна)
├── ПЕРСПЕКТИВА_АГЕНТНОЇ_РОЗРОБКИ      ← стратегічний roadmap
│
└── [Перспективні — не реалізовані в V1]:
    ├── ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND  ← NLM proxy (планується)
    ├── ІНТЕГРАЦІЯ_MEMORY_BACKEND      ← Mastra runtime (планується)
    └── АРХІТЕКТУРА_РОЗГОРТАННЯ_REPLIT  ← NLM deployment (планується)
```

**Порядок читання:**
1. [[ТОПОЛОГІЯ_RUNTIME_NOTEBOOKLM]] — де що запущено
2. [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] — як інтегрувати (практичний bundle)
3. [[ІНТЕГРАЦІЯ_MEMBRIDGE]] — як синхронізується пам'ять + Runtime proxy
4. [[ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] — як відображається стан
5. [[JOB_QUEUE_ТА_ARTIFACT_MODEL]] — state machines задач та артефактів

---

## 4. Authority Boundaries пакету

| Компонент | Task Queue | Artifact Store | claude-mem.db | Leadership Lease |
|-----------|:----------:|:--------------:|:-------------:|:----------------:|
| BLOOM Runtime | Read/Write (orchestrator) | Write (на complete) | — | — |
| Membridge CP | — | Registry metadata | — | Write |
| Worker Agent | Heartbeat + Results | — | Read/Write local | Heartbeat |
| Lovable Frontend | Read + Create | Read | — | — |
| MinIO | — | Storage | Canonical sync | Storage |

**Аксіома A2 (незмінна):** жоден компонент не пише в канонічне сховище поза межами своєї authority boundary. Workers повертають results — Runtime створює artifacts.

---

## 5. Versioning Policy

- Версія пакету: `1.1.0` (2026-02-27)
- Changelog:
  - `1.1.0` — Protocol V1 E2E підтверджений; topology оновлена; перспективні документи позначені
  - `1.0.0` — Initial release (2026-02-24)

---

## Semantic Relations

**Цей документ є частиною:**
- [[ІНДЕКС]] — master entry point Garden Seedling

**Залежить від:**
- [[АРХІТЕКТУРНИЙ_КОРІНЬ]] — аксіоми A1–A7, що визначають межі всіх інтеграцій
- [[UPGRADE_PATH_FOR_MEMBRIDGE_CLIENTS_V1]] — Шлях апгрейду membridge clients (cross-ref з migration/)
