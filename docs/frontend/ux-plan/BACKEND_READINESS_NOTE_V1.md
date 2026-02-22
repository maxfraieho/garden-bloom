---
tags:
  - domain:frontend
  - status:canonical
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "Backend Readiness Note V1"
dg-publish: true
---

# Backend Readiness Note V1

> Created: 2026-02-22
> Author: UX Engineer (Lovable)
> Status: Living document
> Input: [[КОНТРАКТИ_API_V1]], [[СИСТЕМА_PROPOSAL_V1]], [[INBOX_ТА_ЦИКЛ_ЗАПУСКУ_V1]]

---

## 1. Existing Endpoints (implemented & available via Cloudflare Worker)

| Endpoint | Method | Status | Used by |
|----------|--------|--------|---------|
| `/proposals/pending` | GET | ✅ Implemented | `ProposalsInbox` — fetches pending proposals |
| `/proposals/{id}` | GET | ✅ Implemented | Proposal detail view |
| `/proposals/{id}` | PATCH | ✅ Implemented | Accept/reject proposal (status transition) |
| `/zones/{zoneId}/proposals` | GET/POST | ✅ Implemented | Zone-scoped proposals (guest access) |
| `/inbox/submit` | POST | ✅ Specified | Inbox entry creation |
| `/inbox/stats` | GET | ✅ Specified | Inbox statistics |
| `/inbox/entries` | GET | ✅ Specified | Inbox entry list |
| `/agents/run` | POST | ✅ Specified | Run initiation |
| `/runs/{runId}/status` | GET | ✅ Specified | Run polling |
| `/runs/{runId}/steps` | GET | ✅ Specified | Step-by-step results |
| `/health` | GET | ✅ Implemented | Diagnostics health check |
| `/v1/git/status` | GET | ✅ Implemented | Git integration check |

## 2. Missing Endpoints (specified in contracts but NOT in Worker)

| Endpoint | Method | Needed for | Contract ref |
|----------|--------|-----------|-------------|
| `/proposals/history` | GET | **Audit Log UI** — history of accepted/rejected proposals | §3.4 |
| `/proposals/batch` | PATCH | Batch approve/reject | §3.5 |
| `/runs` | GET | **Runs Dashboard** — list of agent runs with filters | §6 |
| `/runs/{runId}/artifacts` | GET | Run artifacts view | §4.1 |
| `/events/stream` | GET (SSE) | Real-time updates (post-MVP) | Appendix B |

## 3. What Can Be Done Purely Frontend (read-only projection)

| Feature | Approach | Status |
|---------|----------|--------|
| **Audit Log UI (History tab)** | Add `getProposalHistory()` API function calling `GET /proposals/history`. If endpoint unavailable (502/404), show informative empty state. No fallback data. | ✅ Can implement now |
| **Folder-based graph clustering** | Extract root folder from note slug (client-side). No API needed. | ✅ Can implement now |
| **Graph search/focus/legend** | Already implemented (Package 1). | ✅ Done |
| **Mobile ChatPage** | Already implemented (Package 2.1). | ✅ Done |

## 4. What Requires API Implementation

| Feature | Missing endpoint | Blocker |
|---------|-----------------|---------|
| **Runs Dashboard** | `GET /runs`, `GET /runs/{runId}/steps`, `GET /runs/{runId}/artifacts` | Cannot show run history without backend |
| **Inbox page** | `GET /inbox/entries`, `GET /inbox/stats` | Endpoints specified but need Worker proxy routes |
| **Batch operations** | `PATCH /proposals/batch` | Specified but not proxied through Worker |
| **Real-time updates** | `GET /events/stream` (SSE) | Post-MVP, polling works for now |

## 5. Backend Infrastructure Status

The backend consists of:
- **Cloudflare Worker** (`_collab/infrastructure/cloudflare/worker/`) — API gateway/proxy
- **Replit Backend** (FastAPI, port 5000) — NotebookLM service, git operations
- **Replit Memory Backend** (Fastify/TypeScript, port 3001) — Agent memory, search

**Current status:** Replit backend is deployed but may be offline (autoscale credits exhausted). The Cloudflare Worker remains available and handles routing to backend services.

**Key observation:** The `/proposals/history` endpoint is fully specified in the API contract (§3.4) with query params (status, agent, from, to, limit, offset) but the Worker proxy route may not be implemented yet. The frontend should call it and handle 404/502 gracefully.

## 6. Diagnostics Consolidation Verification

- ✅ `/admin/diagnostics` route removed from `App.tsx`
- ✅ `AdminDiagnosticsPage.tsx` deleted
- ✅ All links updated to `/admin/settings` (OwnerModeIndicator, NotebookLMSetupPanel, ZoneCreationDialog)
- ✅ Comment in router: `{/* /admin/diagnostics removed — use Settings > Diagnostics tab */}`
- ✅ No broken links found in codebase search
- ✅ Owner-only guard preserved on `/admin/settings`

---

## Semantic Links

- Input: [[КОНТРАКТИ_API_V1]], [[СИСТЕМА_PROPOSAL_V1]], [[INBOX_ТА_ЦИКЛ_ЗАПУСКУ_V1]]
- Related: [[frontend/ux-plan/ПЛАН_ПОКРАЩЕННЯ_UX_V1]]
