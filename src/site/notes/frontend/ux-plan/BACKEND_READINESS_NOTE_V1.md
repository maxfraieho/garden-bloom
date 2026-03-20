---
tags:
  - domain:frontend
  - status:deprecated
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "Backend Readiness Note V1"
dg-publish: true
deprecated_by: "frontend/ux-plan/ГОТОВНІСТЬ_BACKEND_V1.md"
---

> ⚠️ DEPRECATED. Канонічна версія: [[ГОТОВНІСТЬ_BACKEND_V1]]. Цей документ є застарілою EN-копією.


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
| `/proposals/history` | GET | ✅ **Newly added** | History tab — fetches accepted/rejected proposals |
| `/proposals/{id}` | GET | ✅ Implemented | Proposal detail view |
| `/proposals/{id}` | PATCH | ✅ **Newly added** | Accept/reject proposal (status transition via body) |
| `/proposals/{id}/accept` | POST | ✅ Implemented | Legacy accept route |
| `/proposals/{id}/reject` | POST | ✅ Implemented | Legacy reject route |
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
| `/proposals/batch` | PATCH | Batch approve/reject | §3.5 |
| `/runs` | GET | **Runs Dashboard** — list of agent runs with filters | §6 |
| `/runs/{runId}/artifacts` | GET | Run artifacts view | §4.1 |
| `/events/stream` | GET (SSE) | Real-time updates (post-MVP) | Appendix B |

## 3. What Can Be Done Purely Frontend (read-only projection)

| Feature | Approach | Status |
|---------|----------|--------|
| **Audit Log UI (History tab)** | `getProposalHistory()` → `GET /proposals/history` (Worker KV). Graceful fallback if unavailable. | ✅ Done |
| **Folder-based graph clustering** | Extract root folder from note slug (client-side). No API needed. | ✅ Done |
| **Graph search/focus/legend** | Already implemented (Package 1). | ✅ Done |
| **Mobile ChatPage** | Already implemented (Package 2.1). | ✅ Done |

## 4. What Requires API Implementation

| Feature | Missing endpoint | Blocker |
|---------|-----------------|---------|
| **Runs Dashboard** | `GET /runs`, `GET /runs/{runId}/steps`, `GET /runs/{runId}/artifacts` | Cannot show run history — no Worker handler, no KV schema |
| **Inbox page** | `GET /inbox/entries`, `GET /inbox/stats` | Endpoints specified but need Worker proxy routes |
| **Batch operations** | `PATCH /proposals/batch` | Specified but not proxied through Worker |
| **Real-time updates** | `GET /events/stream` (SSE) | Post-MVP, polling works for now |

## 5. Backend Infrastructure Status

The backend consists of:
- **Cloudflare Worker** (`_collab/infrastructure/cloudflare/worker/`) — API gateway + KV storage for proposals/zones/chats
- **Replit Backend** (FastAPI, port 5000) — NotebookLM service, git operations
- **Replit Memory Backend** (Fastify/TypeScript, port 3001) — Agent memory, search

**Current status:** Replit backend is deployed but may be offline (autoscale credits exhausted). The Cloudflare Worker remains available and handles proposals directly via KV (no upstream dependency for proposal CRUD).

### `/proposals/history` route status

- **Proxy route present?** ✅ Yes — direct KV handler (same pattern as `/proposals/pending`)
- **Upstream target:** None needed — proposals stored in Worker KV
- **Deployed?** ✅ Yes (2026-02-22)
- **E2E verified?** ✅ Yes — returns `200 OK` with `{"success":true,"proposals":[],"total":0,"limit":50,"offset":0}`

## 6. Diagnostics Consolidation Verification

- ✅ `/admin/diagnostics` route removed from `App.tsx`
- ✅ `AdminDiagnosticsPage.tsx` deleted
- ✅ All links updated to `/admin/settings` (OwnerModeIndicator, NotebookLMSetupPanel, ZoneCreationDialog)
- ✅ Comment in router: `{/* /admin/diagnostics removed — use Settings > Diagnostics tab */}`
- ✅ No broken links found in codebase search
- ✅ Owner-only guard preserved on `/admin/settings`

## 7. Status Value Mismatch (Action Required)

Worker sets `proposal.status = 'accepted'` on accept, but frontend `STATUS_BADGE_MAP` expects `'approved'` / `'applied'`. The frontend history filter sends `applied,approved,auto_approved` which does not include `'accepted'`. This needs alignment — either:
1. Update Worker to set status `'approved'` instead of `'accepted'`
2. Add `'accepted'` to frontend STATUS_BADGE_MAP and filter params

---

## Semantic Links

- Input: [[КОНТРАКТИ_API_V1]], [[СИСТЕМА_PROPOSAL_V1]], [[INBOX_ТА_ЦИКЛ_ЗАПУСКУ_V1]]
- Related: [[frontend/ux-plan/ПЛАН_ПОКРАЩЕННЯ_UX_V1]]
