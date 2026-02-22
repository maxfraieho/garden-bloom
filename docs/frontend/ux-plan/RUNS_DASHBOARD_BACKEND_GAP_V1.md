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
> Author: UX Engineer (Lovable)
> Status: Blocked — no backend endpoints

---

## Decision: Do NOT build Runs Dashboard UI

**Reason:** No endpoints exist in the Cloudflare Worker for runs management. Building an empty UI with placeholder states adds no user value and creates maintenance burden.

## Required Endpoints (from API Contract §6)

| Endpoint | Method | Purpose | Worker status | Upstream status |
|----------|--------|---------|---------------|-----------------|
| `GET /runs` | GET | List all agent runs with filters | ❌ Missing | ❌ Unknown |
| `GET /runs/{runId}/status` | GET | Run status polling | ❌ Missing (specified) | ❌ Unknown |
| `GET /runs/{runId}/steps` | GET | Step-by-step results | ❌ Missing (specified) | ❌ Unknown |
| `GET /runs/{runId}/artifacts` | GET | Run artifacts | ❌ Missing | ❌ Unknown |
| `POST /agents/run` | POST | Initiate run | ❌ Missing (specified) | ❌ Unknown |

## Required KV Schema

If implementing in Worker KV (same pattern as proposals):

```
runs:recent → [runId, ...] (global index, max 200)
run:{runId} → { runId, agentSlug, status, startedAt, completedAt, steps, artifacts, initiator }
```

## Required Worker Handlers

```javascript
async function handleRunsList(env, request) { /* KV list + filter */ }
async function handleRunGet(runId, env) { /* KV get single run */ }
async function handleRunSteps(runId, env) { /* KV get run steps */ }
async function handleRunCreate(request, env) { /* KV create + trigger upstream */ }
```

## Next Steps

1. Determine if runs are stored in Worker KV or require upstream (Replit) proxy
2. Implement KV schema + handlers in Worker
3. Add routes to Worker routing table
4. Then implement frontend Runs Dashboard UI

---

## Semantic Links

- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
- Input: [[backend/КОНТРАКТИ_API_V1]]
