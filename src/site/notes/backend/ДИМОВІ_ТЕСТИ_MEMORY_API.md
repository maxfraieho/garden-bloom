# Memory API — Smoke Tests

> **Статус:** Operational Guide
> **Аудиторія:** Backend developer, DevOps
> **Оновлено:** 2026-03-08

Canonical API contracts: [`backend/КОНТРАКТИ_API_V1.md`](./КОНТРАКТИ_API_V1.md) §10

---

## Prerequisites

```bash
export BASE_URL="https://notebooklm.exodus.pp.ua"
export SERVICE_TOKEN="<your-service-token>"
export USER_ID="garden-owner"
```

---

## 1. Health Check (без auth)

```bash
curl -f "$BASE_URL/v1/memory/health"
# Expected:
# { "ok": true, "initialized": true, "entityCount": <N> }
```

---

## 2. User Status (auth required)

```bash
curl -f -H "Authorization: Bearer $SERVICE_TOKEN" \
  "$BASE_URL/v1/memory/$USER_ID/status"
# Expected:
# { "ok": true, "initialized": true, "entityCount": <N> }
```

---

## 3. Search Memory

```bash
curl -f -X GET \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  "$BASE_URL/v1/memory/search?q=garden&limit=5"
# Expected:
# { "results": [...] }
```

---

## 4. Context Assembly (Depth Modes)

```bash
# surface/basic
curl -f -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"projects", "depth":"surface"}' \
  "$BASE_URL/v1/memory/context"

# wide (default)
curl -f -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"projects", "depth":"wide"}' \
  "$BASE_URL/v1/memory/context"

# temporal (most expensive)
curl -f -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"projects", "depth":"temporal", "historyLimit":5}' \
  "$BASE_URL/v1/memory/context"
# temporal response MUST include temporalAttachments array
```

---

## 5. Process Transcript (Writer Agent)

```bash
SESSION_ID="smoke-test-$(date +%Y%m%d-%H%M%S)"

curl -f -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"memoryInput\": \"Smoke test session. Testing writer agent. Checked system health.\",
    \"sessionId\": \"$SESSION_ID\",
    \"autoCommit\": true
  }" \
  "$BASE_URL/v1/memory/$USER_ID/process-transcript"
# Expected: entitiesAffected.length >= 1, commitSha present
```

---

## 6. Entity History (Temporal Layer)

```bash
# First, get an entity ID from search results
ENTITY_ID="<entityId from step 3 or 5>"

curl -f -H "Authorization: Bearer $SERVICE_TOKEN" \
  "$BASE_URL/v1/memory/entities/$ENTITY_ID/history?limit=5"
# Expected:
# { "entityId": "...", "history": [...], "count": <N> }
```

---

## 7. Entity Diff

```bash
# Needs 2 commit SHAs from history (step 6)
TO_SHA="<commit sha from history>"
FROM_SHA="<previous commit sha>"

curl -f -H "Authorization: Bearer $SERVICE_TOKEN" \
  "$BASE_URL/v1/memory/entities/$ENTITY_ID/diff?to=$TO_SHA&from=$FROM_SHA"
# Expected:
# { "entityId": "...", "from": "...", "to": "...", "diff": { "patch": "...", "additions": N, "deletions": N } }
```

---

## 8. Entity Revision Snapshot

```bash
curl -f -H "Authorization: Bearer $SERVICE_TOKEN" \
  "$BASE_URL/v1/memory/entities/$ENTITY_ID/revisions/$TO_SHA"
# Expected:
# { "entityId": "...", "sha": "...", "content": "# ..." }
```

---

## 9. Orchestrated Search (Searcher Agent)

```bash
curl -f -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"conversation":[{"role":"user","content":"What system tests were run recently?"}]}' \
  "$BASE_URL/v1/memory/$USER_ID/orchestrated-search"
# Expected:
# { "success": true, "answer": "...", "subQueries": [...], "sources": [...] }
```

---

## 10. Commit Manual

```bash
curl -f -X POST \
  -H "Authorization: Bearer $SERVICE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message": "smoke-test: manual commit"}' \
  "$BASE_URL/v1/memory/commit"
# Expected: { "sha": "...", "message": "..." }
```

---

## 11. CF Worker Proxy Smoke Test

Тест через Cloudflare Worker gateway:

```bash
CF_BASE="https://garden-mcp-server.maxfraieho.workers.dev"
OWNER_TOKEN="<owner-jwt-token>"

# Health (should proxy through to backend)
curl "$CF_BASE/v1/memory/health"

# Auth-required endpoint via Worker
curl -H "Authorization: Bearer $OWNER_TOKEN" \
  "$CF_BASE/v1/memory/$USER_ID/status"
```

---

## Expected Baseline

| Test | Expected | Timeout |
|------|----------|---------|
| Health check | 200 in < 2s | 5s |
| Status | 200 in < 3s | 10s |
| Search | 200 with results in < 5s | 15s |
| Context wide | 200 in < 10s | 30s |
| Context temporal | 200 in < 20s | 60s |
| Process transcript | 200 with entities in < 30s | 120s |
| Orchestrated search | 200 with answer in < 45s | 90s |
| Entity history | 200 in < 3s | 10s |
| Entity diff | 200 in < 3s | 10s |
