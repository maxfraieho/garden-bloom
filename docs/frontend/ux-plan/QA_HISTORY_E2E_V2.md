---
tags:
  - domain:frontend
  - status:canonical
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "QA History E2E V2"
dg-publish: true
---

# QA History E2E V2

> Created: 2026-02-22
> Author: UX Engineer (Lovable)
> Status: **PASSED** — all flows verified live

---

## 1. Accept → History Flow ✅

### Steps performed:
1. Navigated to zone "Все" (`/zone/a4d0d18e?code=ACCESS-BD7972FA`)
2. Opened GRAPH_CONTRACT note → clicked "Запропонувати редагування"
3. Added `<!-- QA test edit by Lovable -->` at end, name: "Lovable QA Tester"
4. Submitted → `POST /zones/a4d0d18e/proposals` → **201** (1240ms)
5. Navigated to `/chat` → proposal appeared in Inbox with badge "1"
6. Opened History tab first (to set `historyLoaded = true`)
7. Switched to Inbox → clicked proposal → diff view opened (Side by Side, "+2 added")
8. Clicked "Прийняти зміни"

### Network observed:
| Request | Status | Duration |
|---------|--------|----------|
| `PATCH /proposals/prop_1771787099926_...` | **200** | 4816ms |
| `GET /proposals/history?status=accepted,applied,rejected,auto_approved,expired&limit=50` | **200** | 44ms |

### UI result:
- Proposal disappeared from Inbox ("Немає очікуючих пропозицій")
- Toast: "Пропозицію схвалено та закомічено в репозиторій"
- History tab: GRAPH_CONTRACT with **"Approved"** badge, timestamp "4 minutes ago"
- Auto-refresh confirmed — `fetchHistory()` was triggered automatically

---

## 2. Reject → History Flow ✅

### Steps performed:
1. Created 2nd proposal on README note, name: "QA Reject Tester"
2. `POST /zones/a4d0d18e/proposals` → **201**
3. Opened History tab (historyLoaded = true), then Inbox
4. Clicked proposal → diff view → clicked "Відхилити"
5. Rejection dialog appeared with textarea (min 10 chars)
6. Entered: "QA test: rejecting for E2E verification purposes"
7. Clicked "Підтвердити відхилення"

### Network observed:
| Request | Status | Duration |
|---------|--------|----------|
| `PATCH /proposals/prop_1771787321232_...` | **200** | 1096ms |
| `GET /proposals/history?status=accepted,...&limit=50` | **200** | 34ms |

### UI result:
- Proposal disappeared from Inbox
- Toast: "Пропозицію відхилено"
- History tab: README with **"Rejected"** badge, "less than a minute ago"
- Both proposals visible in History (README rejected, GRAPH_CONTRACT approved)

---

## 3. History Filters Verification ✅

Filters **All / Approved / Rejected** work **client-side** (no new network request on filter switch). The initial `GET /proposals/history` fetches all statuses, then UI filters locally.

### Status alignment:
- Worker sets `status: 'accepted'` on accept, `status: 'rejected'` on reject
- Frontend `STATUS_BADGE_MAP` includes `accepted` → maps to "Approved" badge ✅
- Frontend `STATUS_BADGE_MAP` includes `rejected` → maps to "Rejected" badge ✅
- Filter params include `accepted` in the query: `status=accepted,applied,rejected,auto_approved,expired` ✅

**No mismatch issue** — status alignment is correct after previous fix.

---

## 4. Error Resilience (confirmed by code + pre-deploy observation)

| Scenario | Result |
|----------|--------|
| History endpoint returns 404 | Shows "Audit history not available" + Retry |
| History endpoint returns 502 | Same graceful fallback |
| Network offline | Shows network error message |
| `historyLoaded = false` when accept/reject | No wasted `fetchHistory()` call |

---

## Summary

| Flow | Status | Evidence |
|------|--------|----------|
| Guest → Submit proposal | ✅ PASSED | POST 201, proposal in Inbox |
| Owner → Accept proposal | ✅ PASSED | PATCH 200, removed from Inbox, appeared in History with Approved badge |
| Owner → Reject proposal | ✅ PASSED | PATCH 200, removed from Inbox, appeared in History with Rejected badge |
| Auto-refresh history | ✅ PASSED | GET /proposals/history triggered after both accept and reject |
| Filters (All/Approved/Rejected) | ✅ PASSED | Client-side filtering, no extra requests |
| Status alignment | ✅ RESOLVED | `accepted` mapped correctly to "Approved" badge |

---

## Semantic Links

- Related: [[frontend/ux-plan/PROPOSAL_HISTORY_FLOW_VERIFICATION_V1]]
- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
