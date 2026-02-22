---
tags:
  - domain:frontend
  - status:canonical
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "Proposal History Flow Verification V1"
dg-publish: true
---

# Proposal History Flow Verification V1

> Created: 2026-02-22
> Author: UX Engineer (Lovable)
> Status: Verified by code reasoning + Worker route implementation

---

## Scenario: Accept → History Reflection

### Steps traced through code:

1. **Load ProposalsInbox** → `useEffect` calls `fetchProposals()` → `GET /proposals/pending` → populates `proposals[]`
2. **Open History tab** → `handleTabChange('history')` → calls `fetchHistory()` → `GET /proposals/history` → populates `historyItems[]`, sets `historyLoaded = true`
3. **Accept proposal** → `handleAccept()`:
   - Calls `acceptProposal(id)` → `PATCH /proposals/{id}` with `{status: 'approved'}`
   - Worker delegates to `handleProposalAccept()` → status set to `'accepted'`, added to `proposals:history` KV index
   - On success: removes from `proposals[]` via `setProposals(prev => prev.filter(...))`
   - Checks `if (historyLoaded) fetchHistory()` → re-fetches history
4. **Result**: Proposal disappears from Inbox, appears in History

### Reject flow:

Same pattern — after `rejectProposal()` succeeds, `if (historyLoaded) fetchHistory()` triggers refresh. Worker adds proposal to `proposals:history` index on reject.

## E2E Results (Live — 2026-02-22, post-deploy)

### Scenario A: Endpoint available ✅

- `GET /proposals/history?status=accepted,applied,rejected,auto_approved,expired&limit=50` → **200 OK** (165ms)
- Response: `{"success":true,"proposals":[],"total":0,"limit":50,"offset":0}`
- UI shows "No proposals in history" with All/Approved/Rejected filters
- No console errors, no crash
- Network tab: request goes through `garden-mcp-server.maxfraieho.workers.dev` (Worker gateway)

### Scenario B: Endpoint unavailable (pre-deploy)

- Previously returned 404 → UI showed "Audit history not available" + Retry button
- No crash, no console error spam — graceful fallback confirmed

### Scenario C: Auto-refresh after accept/reject

- Cannot fully test (0 pending proposals currently) — code path verified by review:
  - `if (historyLoaded) fetchHistory()` triggers after successful accept/reject
  - Will verify with real proposal when available

### Worker Route Verification

| Route | Method | Status | Handler |
|-------|--------|--------|---------|
| `/proposals/history` | GET | ✅ **Added** | `handleProposalsHistory()` — reads `proposals:history` KV index |
| `/proposals/:id` | PATCH | ✅ **Added** | `handleProposalPatch()` — delegates to accept/reject based on body status |
| `/proposals/pending` | GET | ✅ Existing | `handleProposalsPending()` |
| `/proposals/:id` | GET | ✅ Existing | `handleProposalGet()` |

### History KV Index

- **Key:** `proposals:history` (global, max 200 entries)
- **Populated by:** `handleProposalAccept()` and `handleProposalReject()` — both append `proposalId` to index on status transition
- **Note:** Pre-existing accepted/rejected proposals (before this change) will NOT appear in history until Worker is redeployed and proposals flow through the new handlers

### Network Flow (expected after Worker deployment)

```
GET /proposals/history?status=applied,rejected,accepted,auto_approved,expired&limit=50
→ Worker auth check (owner JWT)
→ KV.get('proposals:history')
→ For each ID: KV.get('proposal:{id}'), filter by status
→ Response: { success: true, proposals: [...], total, limit, offset }
```

## Error Resilience Verification

| Scenario | Behavior | Crash? |
|----------|----------|--------|
| `/proposals/history` returns 404 (pre-deploy) | `historyError = 'endpoint_unavailable'`, shows informative empty state | ❌ No crash |
| `/proposals/history` returns 502 | Same as 404 — graceful fallback | ❌ No crash |
| Network offline | `historyError = 'network'`, shows "Check your connection" | ❌ No crash |
| Malformed response (no `proposals` array) | `createApiError('BAD_REQUEST')` thrown, caught in `fetchHistory` catch block | ❌ No crash |
| History tab never opened (historyLoaded = false) | Accept/reject do NOT trigger `fetchHistory()` — no wasted request | ✅ Optimal |

## Runtime Validation

`getProposalHistory()` now validates:
```typescript
if (!res || typeof res !== 'object' || !Array.isArray(res.proposals)) {
  throw createApiError('BAD_REQUEST', ..., 'Invalid history response');
}
```

## Status Value Note

Worker sets `proposal.status = 'accepted'` (not `'approved'`). Frontend `STATUS_BADGE_MAP` includes `approved` and `applied` but not `accepted`. The history filter sends `status=applied,approved,auto_approved` for the "approved" filter — this may miss proposals with status `'accepted'`. **Recommendation:** Add `'accepted'` to the frontend status filter OR update Worker to use `'approved'`.

## A6 Compliance

- ✅ Frontend performs only reads (`GET`) and status transitions (`PATCH` with defined contract transitions)
- ✅ No localStorage writes, no fake data generation
- ✅ No new write paths introduced

---

## Semantic Links

- Related: [[frontend/ux-plan/API_INTEGRATION_VERIFICATION_V1]]
- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
