# Memory Subsystem — Garden Bloom

> DiffMem-inspired git-based differential memory for AI agents.

## Роль цього пакету

Пакет `docs/memory/` містить **implementation-level документацію** для Memory підсистеми.

**Canonical архітектурні специфікації знаходяться в:**
- [`architecture/features/ПАМ_ЯТЬ_АГЕНТА_GIT_DIFFMEM_V1.md`](../architecture/features/ПАМ_ЯТЬ_АГЕНТА_GIT_DIFFMEM_V1.md) — архітектура, token limits, eviction
- [`architecture/runtime/BLOOM_MEMORY_ARCHITECTURE.md`](../architecture/runtime/BLOOM_MEMORY_ARCHITECTURE.md) — persistence model
- [`architecture/runtime/АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1.md`](../architecture/runtime/АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1.md) — [[../architecture/runtime/АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1|АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]] — canonical memory flow: Obsidian / MinIO / obsidian-mcp / BLOOM backend / proposal/apply lifecycle
- [`backend/КОНТРАКТИ_API_V1.md`](../backend/КОНТРАКТИ_API_V1.md) (§10) — **canonical API contracts**
- [`frontend/ПАМ_ЯТЬ_DIFFMEM_ІНТЕГРАЦІЯ.md`](../frontend/ПАМ_ЯТЬ_DIFFMEM_ІНТЕГРАЦІЯ.md) — frontend integration spec

---

## 📁 Зміст

### Canonical (implementation-level)

| Файл | Роль | Опис |
|------|------|------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Implementation guide | Deployment architecture, layers, diagrams |
| [API_CONTRACT.md](./API_CONTRACT.md) | Implementation reference | REST API spec (деталізація `backend/КОНТРАКТИ_API_V1.md` §10) |

### Prompt artifacts (для агентів)

| Файл | Агент | Опис |
|------|-------|------|
| [prompts/01_REPLIT_MASTRA_SETUP.md](./prompts/01_REPLIT_MASTRA_SETUP.md) | Replit | Mastra + DiffMem backend setup |
| [prompts/02_CLOUDFLARE_WORKER_ROUTES.md](./prompts/02_CLOUDFLARE_WORKER_ROUTES.md) | CF Worker | Memory routes для gateway |
| [prompts/03_MASTRA_AGENTS_CONFIG.md](./prompts/03_MASTRA_AGENTS_CONFIG.md) | Replit | Mastra agents: Writer + Searcher |
| [REPLIT_IMPLEMENTATION_GUIDE.md](./REPLIT_IMPLEMENTATION_GUIDE.md) | Replit | Повний implementation guide для backend |
| [LOVABLE_PROMPT_FRONTEND_V2.md](./LOVABLE_PROMPT_FRONTEND_V2.md) | Lovable | Frontend tasks prompt (historical) |

### Historical / snapshots

| Файл | Опис |
|------|------|
| [IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md) | Snapshot стану реалізації (Phase 1–2, 2026-02-22) |
| [BACKEND_STATUS.md](./BACKEND_STATUS.md) | Snapshot стану backend (2026-02-22) |

---

## 📊 Architecture Overview

```
Frontend (React) → Gateway (CF Worker) → Backend (Replit + Mastra)
                                              │
                                         DiffMem Adapter
                                              │
                                    Git Repo (Markdown files)
```

Key concepts from DiffMem:
- **Current-state focus**: Only current Markdown files are searched/indexed
- **Git history for depth**: Temporal reasoning via git diffs
- **4-level context**: surface → wide → deep → temporal
- **BM25 search**: Fast, explainable text retrieval
- **Mastra agents**: Writer (process transcripts) + Searcher (answer questions)
