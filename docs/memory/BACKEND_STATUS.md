# Memory Backend — Live Status

**Deployment:** Replit (`~/projects/notebooklm`)
**Status:** ✅ Production-ready
**Tested:** 2026-02-22

---

## What's Live

### Endpoints (all behind CF Worker `/v1/memory/*`)

| Method | Path | Status | Description |
|--------|------|--------|-------------|
| GET | `/v1/memory/health` | ✅ | `{ ok, initialized, entityCount }` — no auth |
| POST | `/v1/memory/garden-owner/onboard` | ✅ | Initialize user memory |
| GET | `/v1/memory/garden-owner/entities` | ✅ | List/search entities |
| GET | `/v1/memory/context/:id` | ✅ | Graph context (4 depths) |
| POST | `/v1/memory/garden-owner/orchestrated-search` | ✅ | Claude-powered search, tested 53 entities → 6 citations |
| POST | `/v1/memory/garden-owner/process-transcript` | ✅ | Extract entities from raw text, commit to git |
| POST | `/v1/memory/init` | ✅ | Manual init/refresh |
| POST | `/v1/memory/refresh` | ✅ | Re-index entities |
| POST | `/v1/memory/commit` | ✅ | Commit + push to GitHub |

**Auth:** `Authorization: Bearer $NOTEBOOKLM_SERVICE_TOKEN` (all except health)

### Proven in Testing
- Cloned `maxfraieho/garden-seedling` → 53 entities indexed
- Orchestrated search: 4 tool calls → detailed answer with 6 citations
- Process transcript: extracts + commits structured entities
- Safety caps: 15 iterations (search), 20 iterations (writer)

---

## What's Already Built in Frontend

### Types (complete)
`src/types/agentMemory.ts` — all request/response interfaces:
`MemoryEntity`, `ContextRequest`, `ContextResponse`, `MemorySearchRequest`,
`OrchestratedSearchRequest`, `MemoryProcessRequest`, `MemoryUserStatus`, etc.

### API Client (complete)
`src/lib/api/mcpGatewayClient.ts` — all methods implemented:
`getMemoryContext()`, `searchMemory()`, `orchestratedSearchMemory()`,
`processAndCommitMemory()`, `getMemoryEntity()`, `getMemoryStatus()`, etc.

---

## What Lovable Needs to Build

### 1. `useAgentMemory` hook
`src/hooks/useAgentMemory.ts`

```typescript
// Minimal interface:
const {
  search,        // (query: string) => Promise<MemorySearchResponse>
  getContext,    // (depth: ContextDepth) => Promise<ContextResponse>
  processText,   // (text: string) => Promise<MemoryProcessResponse>
  status,        // MemoryUserStatus | null
  isLoading,
  error,
} = useAgentMemory(userId);
```

Uses `mcpGatewayClient` internally — no new API code needed.

### 2. Memory Panel UI
A sidebar panel or modal with:
- **Search tab** — text input → `orchestratedSearchMemory()` → answer + citations
- **Context tab** — depth selector (basic/wide/deep/temporal) → context preview
- **Add Memory tab** — textarea → `processAndCommitMemory()` → shows affected entities
- **Status** — entity count, last sync, index health

### 3. Integration Points in Existing UI
- Note view: "Ask about related memories" button → orchestrated search with note slug as context
- Graph view: click node → show memory context for that entity if exists
- Chat/agent views (if any): auto-load `basic` context before each interaction

---

## CF Worker Config (already done)

```toml
# wrangler.toml — already configured:
MEMORY_BACKEND_URL = "https://notebooklm.replit.app"  # Replit URL
NOTEBOOKLM_SERVICE_TOKEN = "<secret>"                  # in CF secrets
```

Routes `/v1/memory/*` → proxy to Replit backend.

---

## Entity Structure (for UI rendering)

```typescript
// Entities stored as Markdown in git:
// memory-repo/users/garden-owner/entities/{type}/{name}.md

// Types: people | project | concept | timeline | session | artifact
// Example entity ID: "people/max" or "concepts/agentic-memory"

// Entity has:
// - frontmatter: { name, type, tags, updatedAt }
// - ALWAYS_LOAD block: 5-7 key facts (always shown)
// - Full content: detailed notes, interactions, context
```
