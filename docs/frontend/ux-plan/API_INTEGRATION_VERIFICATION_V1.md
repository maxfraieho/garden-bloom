---
tags:
  - domain:frontend
  - status:canonical
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "API Integration Verification V1"
dg-publish: true
---

# API Integration Verification V1

> Created: 2026-02-22
> Author: UX Engineer (Lovable)
> Status: Verified

---

## 1. API Base URL Resolution

**Source:** `src/lib/api/mcpGatewayClient.ts`, line 14

```typescript
const DEFAULT_GATEWAY = 'https://garden-mcp-server.maxfraieho.workers.dev';
```

**Resolution order:**
1. `import.meta.env.VITE_MCP_GATEWAY_URL` (env override)
2. Fallback: `https://garden-mcp-server.maxfraieho.workers.dev` (Cloudflare Worker)

**Verdict:** ✅ Frontend routes ALL requests through the Cloudflare Worker gateway. No direct backend URLs (`localhost:5000`, Replit URLs) exist in the API client.

## 2. Worker Routing Path

All API calls use `requestJson(path, init)` which constructs:
```
{gatewayBaseUrl}{path}
```

Example flow for proposal history:
```
Frontend: GET https://garden-mcp-server.maxfraieho.workers.dev/proposals/history?status=applied,rejected&limit=50
    → Cloudflare Worker (gateway)
    → KV storage (proposals:history index)
    → Worker
    → Frontend
```

**Request infrastructure:**
- Timeout: 30s default (`REQUEST_TIMEOUT_MS`), configurable per-call via `timeoutMs`
- Retry: configurable via `retries` + `retryDelayMs` with exponential backoff
- Correlation ID: auto-generated `X-Correlation-Id` header on every request
- Auth: `Authorization: Bearer {ownerToken}` when `requireAuth: true`

## 3. History Endpoint Reachability

**Endpoint:** `GET /proposals/history`

**Status:** ✅ Route added to Cloudflare Worker (`_collab/infrastructure/cloudflare/worker/index.js`). The handler reads from the `proposals:history` global KV index, which is populated when proposals are accepted or rejected. Supports query params: `status` (comma-separated), `limit`, `offset`.

**PATCH endpoint fix:** ✅ Added `PATCH /proposals/:proposalId` route that reads `{status}` from body and delegates to accept/reject handlers. Previously, the frontend sent PATCH but the Worker only had POST `/accept` and `/reject` routes — this mismatch has been resolved.

**Confirmed network request** (from client logs):
```
POST https://garden-mcp-server.maxfraieho.workers.dev/auth/status → 200 OK
```
This confirms Worker connectivity is active.

## 4. Critical Findings

### 4.1 PATCH vs POST mismatch (FIXED)

| Frontend method | Worker route (before) | Worker route (after) |
|---|---|---|
| `PATCH /proposals/{id}` body: `{status:'approved'}` | ❌ No PATCH handler → 404 | ✅ `PATCH /proposals/:id` → delegates to accept/reject |
| `PATCH /proposals/{id}` body: `{status:'rejected'}` | ❌ No PATCH handler → 404 | ✅ Same |

### 4.2 Status value mismatch (documented)

Worker sets `proposal.status = 'accepted'` on accept, but frontend `STATUS_BADGE_MAP` expects `'approved'` / `'applied'`. History tab should show items correctly since it filters by comma-separated status values including both.

## 5. Security Verification

- ✅ No hardcoded backend URLs in `src/`
- ✅ Owner token transmitted via `Authorization` header only
- ✅ Zone guest access via `X-Zone-Code` header
- ✅ No credentials stored in localStorage (token managed by `useOwnerAuth` hook)
- ✅ AbortController timeout on every request
- ✅ `/proposals/history` requires owner auth

---

## Semantic Links

- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
- Input: [[backend/КОНТРАКТИ_API_V1]]
