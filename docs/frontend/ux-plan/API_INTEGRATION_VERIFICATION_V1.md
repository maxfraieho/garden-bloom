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
    → Backend (Replit FastAPI / KV)
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

**Status:** The endpoint is defined in the API contract (§3.4) and the frontend client (`getProposalHistory()`) is implemented. The Worker proxy route may or may not be deployed — the frontend handles 404/502 gracefully with an informative empty state.

**Confirmed network request** (from client logs):
```
POST https://garden-mcp-server.maxfraieho.workers.dev/auth/status → 200 OK
```
This confirms Worker connectivity is active.

## 4. Security Verification

- ✅ No hardcoded backend URLs in `src/`
- ✅ Owner token transmitted via `Authorization` header only
- ✅ Zone guest access via `X-Zone-Code` header
- ✅ No credentials stored in localStorage (token managed by `useOwnerAuth` hook)
- ✅ AbortController timeout on every request

---

## Semantic Links

- Related: [[frontend/ux-plan/BACKEND_READINESS_NOTE_V1]]
- Input: [[backend/КОНТРАКТИ_API_V1]]
