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
> Status: Verified by code reasoning

---

## Scenario: Accept → History Reflection

### Steps traced through code:

1. **Load ProposalsInbox** → `useEffect` calls `fetchProposals()` → `GET /proposals/pending` → populates `proposals[]`
2. **Open History tab** → `handleTabChange('history')` → calls `fetchHistory()` → `GET /proposals/history` → populates `historyItems[]`, sets `historyLoaded = true`
3. **Accept proposal** → `handleAccept()`:
   - Calls `acceptProposal(id)` → `PATCH /proposals/{id}` with `{status: 'approved'}`
   - On success: removes from `proposals[]` via `setProposals(prev => prev.filter(...))`
   - Checks `if (historyLoaded) fetchHistory()` → re-fetches history
4. **Result**: Proposal disappears from Inbox, appears in History (if backend returns it in history endpoint)

### Reject flow:

Same pattern — after `rejectProposal()` succeeds, `if (historyLoaded) fetchHistory()` triggers refresh.

## Error Resilience Verification

| Scenario | Behavior | Crash? |
|----------|----------|--------|
| `/proposals/history` returns 404 | `historyError = 'endpoint_unavailable'`, shows informative empty state | ❌ No crash |
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

## A6 Compliance

- ✅ Frontend performs only reads (`GET`) and status transitions (`PATCH` with defined contract transitions)
- ✅ No localStorage writes, no fake data generation
- ✅ No new write paths introduced

---

## Semantic Links

- Related: [[frontend/ux-plan/API_INTEGRATION_VERIFICATION_V1]]
- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
