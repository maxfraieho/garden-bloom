---
tags:
  - domain:frontend
  - status:canonical
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "Runs Dashboard Backend Gap V1"
dg-publish: true
---

# Runs Dashboard Backend Gap V1

> Created: 2026-02-22
> Updated: 2026-02-22
> Author: UX Engineer (Lovable)
> Status: **MVP Unblocked** — core endpoints implemented in Worker KV

---

## Decision: Runs API MVP implemented, UI can proceed

**Previous status:** Blocked — no endpoints existed.
**Current status:** 5 endpoints implemented in Cloudflare Worker with KV storage. Ready for frontend UI development.

## Implemented Endpoints (Worker KV)

| Endpoint | Method | Purpose | Status |
|----------|--------|---------|--------|
| `POST /agents/run` | POST | Create a new run (status: `requested`) | ✅ Implemented |
| `GET /runs` | GET | List runs with filters (status, agent, limit, offset) | ✅ Implemented |
| `GET /runs/{runId}/status` | GET | Run status polling (lightweight) | ✅ Implemented |
| `GET /runs/{runId}/steps` | GET | Step-by-step results | ✅ Implemented |
| `GET /runs/{runId}/artifacts` | GET | Run artifacts | ✅ Implemented |

All endpoints are **owner-only** (JWT required).

## KV Schema

```
runs:recent → [runId, ...] (max 200, newest first)
run:{runId} → { runId, agentSlug, status, startedAt, updatedAt, completedAt, durationMs, initiator, summary, params }
run:{runId}:steps → [{ idx, name, status, startedAt, endedAt, outputPreview }]
run:{runId}:artifacts → [{ name, type, url, inline }]
```

### Run Statuses

`requested` → `queued` → `running` → `completed` | `failed` | `cancelled`

## Response Examples

### POST /agents/run
```json
{
  "success": true,
  "run": {
    "runId": "run_1708635600000_abc123",
    "agentSlug": "comet",
    "status": "requested",
    "startedAt": 1708635600000,
    "updatedAt": 1708635600000,
    "initiator": "owner"
  }
}
```

### GET /runs
```json
{
  "success": true,
  "runs": [...],
  "total": 5,
  "limit": 20,
  "offset": 0
}
```

### GET /runs/{runId}/status
```json
{
  "success": true,
  "runId": "run_...",
  "status": "completed",
  "startedAt": 1708635600000,
  "updatedAt": 1708635700000,
  "completedAt": 1708635700000,
  "durationMs": 100000
}
```

## Still Missing (post-MVP)

| Endpoint | Method | Purpose | Priority |
|----------|--------|---------|----------|
| `PATCH /runs/{runId}` | PATCH | Update run status/steps (for agent callbacks) | Medium |
| `GET /events/stream` | GET (SSE) | Real-time run updates | Low (post-MVP) |
| Advanced filters | — | Date range, duration, full-text search | Low |

## Next Steps

1. ✅ ~~Implement KV schema + handlers in Worker~~ Done
2. ✅ ~~Add routes to Worker routing table~~ Done
3. **Deploy Worker** (manual via Cloudflare Dashboard or `wrangler deploy`)
4. **Verify endpoints** via curl
5. Build frontend Runs Dashboard UI (Package 3.1)

---

## Semantic Links

- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
- Input: [[backend/КОНТРАКТИ_API_V1]]
