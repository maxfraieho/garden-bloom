---
{"tags":["domain:meta","status:canonical","format:inventory"],"created":"2026-02-24","updated":"2026-02-24","tier":1,"title":"Integration Layer — Індекс пакету","dg-publish":true,"permalink":"/membridge/integration/_INDEX/","dgPassFrontmatter":true,"noteIcon":""}
---


# Integration Layer — Індекс пакету

> Created: 2026-02-24
> Author: architect
> Status: canonical
> Мова: Ukrainian (canonical)

---

## 0. Призначення

Цей пакет визначає архітектурний шар інтеграції між чотирма компонентами, що розширюють ядро Garden Seedling:

- **NotebookLM Backend** — FastAPI Cognitive Proxy (Replit); інструмент `notebooklm-query`
- **Memory Backend** — Mastra runtime + `garden-bloom-memory` git-монорепо
- **Membridge Control Plane** — інфраструктура синхронізації пам'яті між вузлами
- **Lovable Frontend** — Projection Layer; читає канонічний стан через Gateway

Усі документи цього пакету є Tier-1 canonical і є частиною NotebookLM Canonical Set.

---

## 1. Manifest

| Документ | Домен | Формат | Призначення |
|----------|-------|--------|-------------|
| [[membridge/integration/ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND\|ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND]] | `api` | `spec` | FastAPI Cognitive Proxy: ролі, контракт, стан-машина |
| [[membridge/integration/ІНТЕГРАЦІЯ_MEMORY_BACKEND\|ІНТЕГРАЦІЯ_MEMORY_BACKEND]] | `storage` | `spec` | Mastra + git memory: Layer 1/2, BM25, context assembly |
| [[membridge/integration/ІНТЕГРАЦІЯ_MEMBRIDGE\|ІНТЕГРАЦІЯ_MEMBRIDGE]] | `storage` | `contract` | Leadership, lease, artifact registry, control-plane API |
| [[membridge/integration/ІНТЕГРАЦІЯ_FRONTEND_LOVABLE\|ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] | `frontend` | `spec` | Inbox, Proposal lifecycle, Job state machine, Artifact viewer |
| [[membridge/integration/RUNTIME_TOPOLOGY_NOTEBOOKLM\|RUNTIME_TOPOLOGY_NOTEBOOKLM]] | `arch` | `spec` | Вузли, сервіси, порти, trust boundaries, data flow |
| [[membridge/integration/JOB_QUEUE_ТА_ARTIFACT_MODEL\|JOB_QUEUE_ТА_ARTIFACT_MODEL]] | `execution` | `contract` | State machines, Artifact model, Authority matrix |
| [[membridge/integration/DEPLOYMENT_REPLIT_АРХІТЕКТУРА\|DEPLOYMENT_REPLIT_АРХІТЕКТУРА]] | `arch` | `guide` | Replit deployment: cold start, secrets, persistence, CI/CD |

---

## 2. Позиція в архітектурі Garden Seedling

```
┌─────────────────────────────────────────────────────────┐
│                  Garden Bloom System                    │
│                                                         │
│  ┌──────────────┐   Gateway   ┌────────────────────┐   │
│  │   Lovable    │◄──────────► │  Cloudflare Worker │   │
│  │  Frontend    │  (read-only)│  (write gatekeeper) │   │
│  └──────────────┘             └────────┬───────────┘   │
│                                        │               │
│              ┌─────────────────────────┼─────────────┐  │
│              │     Orchestration Layer │(Hatchet)    │  │
│              └─────────────────────────┬─────────────┘  │
│                         ┌─────────────┴──────────────┐  │
│                         │        Mastra Runtime       │  │
│                         │   ┌─────────┐  ┌────────┐  │  │
│                         │   │NLM Tool │  │Memory  │  │  │
│                         │   │(FastAPI)│  │Tool    │  │  │
│                         │   └────┬────┘  └───┬────┘  │  │
│                         └────────┼───────────┼───────┘  │
│                                  │           │          │
│  ┌───────────────────┐     ┌─────▼──────┐  ┌─▼───────┐ │
│  │  Membridge        │     │ NLM Backend│  │ Memory  │ │
│  │  Control Plane    │     │ (Replit)   │  │ Backend │ │
│  │  Alpine :8000/8001│     └────────────┘  │(Mastra/ │ │
│  └──────────┬────────┘                     │ git)    │ │
│             │                              └────┬────┘ │
│  ┌──────────▼────────────────────────────────▼──┐     │
│  │              MinIO Object Storage             │     │
│  │  (canonical DB · artifacts · agent definitions) │   │
│  └───────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Залежності між документами

```
_INDEX
├── RUNTIME_TOPOLOGY_NOTEBOOKLM        ← читати першим
├── JOB_QUEUE_ТА_ARTIFACT_MODEL        ← читати другим
├── ІНТЕГРАЦІЯ_MEMBRIDGE               ← залежить від TOPOLOGY
├── ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND      ← залежить від JOB_QUEUE + MEMBRIDGE
├── ІНТЕГРАЦІЯ_MEMORY_BACKEND          ← залежить від MEMBRIDGE
├── ІНТЕГРАЦІЯ_FRONTEND_LOVABLE        ← залежить від JOB_QUEUE + NLM
└── DEPLOYMENT_REPLIT_АРХІТЕКТУРА      ← залежить від NLM_BACKEND
```

**Порядок читання для нового учасника:**
1. [[membridge/integration/RUNTIME_TOPOLOGY_NOTEBOOKLM\|RUNTIME_TOPOLOGY_NOTEBOOKLM]] — де що запущено
2. [[membridge/integration/JOB_QUEUE_ТА_ARTIFACT_MODEL\|JOB_QUEUE_ТА_ARTIFACT_MODEL]] — як рухається робота
3. [[membridge/integration/ІНТЕГРАЦІЯ_MEMBRIDGE\|ІНТЕГРАЦІЯ_MEMBRIDGE]] — як синхронізується пам'ять
4. [[membridge/integration/ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND\|ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND]] — як обробляються завдання
5. [[membridge/integration/ІНТЕГРАЦІЯ_MEMORY_BACKEND\|ІНТЕГРАЦІЯ_MEMORY_BACKEND]] — як збирається контекст
6. [[membridge/integration/ІНТЕГРАЦІЯ_FRONTEND_LOVABLE\|ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] — як відображається стан
7. [[membridge/integration/DEPLOYMENT_REPLIT_АРХІТЕКТУРА\|DEPLOYMENT_REPLIT_АРХІТЕКТУРА]] — як розгортається сервіс

---

## 4. Authority Boundaries пакету

| Компонент | MinIO / git | Artifact Store | Job Queue | Leadership Lease |
|-----------|:-----------:|:--------------:|:---------:|:----------------:|
| NotebookLM Backend | Append | Write (нові артефакти) | Read + Status | — |
| Memory Backend | Write (primary) | Read | — | — |
| Membridge Control Plane | Registry (metadata) | Registry | — | Write |
| Lovable Frontend | — | Read | Write (create) | — |
| Membridge Agent | Read/Write local | — | — | Heartbeat |

**Аксіома A2 (незмінна):** жоден компонент не пише в канонічне сховище поза межами своєї authority boundary.

---

## 5. Versioning Policy

- Версія пакету: `1.0.0` (2026-02-24)
- Оновлення будь-якого документу: оновити `updated:` у frontmatter відповідного файлу.
- Зміна authority boundaries або state machine invariants → мажорна версія всього пакету.
- Публікація у NotebookLM: усі документи з `dg-publish: true`.

---

## Semantic Relations

**Цей документ є частиною:**
- [[exodus.pp.ua/ІНДЕКС\|ІНДЕКС]] — master entry point Garden Seedling

**Залежить від:**
- [[exodus.pp.ua/architecture/foundation/АРХІТЕКТУРНИЙ_КОРІНЬ\|АРХІТЕКТУРНИЙ_КОРІНЬ]] — аксіоми A1–A7, що визначають межі всіх інтеграцій
- [[exodus.pp.ua/architecture/core/КАНОНІЧНА_МОДЕЛЬ_АВТОРИТЕТУ_СХОВИЩА\|КАНОНІЧНА_МОДЕЛЬ_АВТОРИТЕТУ_СХОВИЩА]] — матриця запису/читання

**На цей документ посилаються:**
- [[membridge/integration/ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND\|ІНТЕГРАЦІЯ_NOTEBOOKLM_BACKEND]]
- [[membridge/integration/ІНТЕГРАЦІЯ_MEMORY_BACKEND\|ІНТЕГРАЦІЯ_MEMORY_BACKEND]]
- [[membridge/integration/ІНТЕГРАЦІЯ_MEMBRIDGE\|ІНТЕГРАЦІЯ_MEMBRIDGE]]
- [[membridge/integration/ІНТЕГРАЦІЯ_FRONTEND_LOVABLE\|ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]]
- [[membridge/integration/RUNTIME_TOPOLOGY_NOTEBOOKLM\|RUNTIME_TOPOLOGY_NOTEBOOKLM]]
- [[membridge/integration/JOB_QUEUE_ТА_ARTIFACT_MODEL\|JOB_QUEUE_ТА_ARTIFACT_MODEL]]
- [[membridge/integration/DEPLOYMENT_REPLIT_АРХІТЕКТУРА\|DEPLOYMENT_REPLIT_АРХІТЕКТУРА]]
