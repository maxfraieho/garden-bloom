# Agent Memory System — Implementation Status

**Date:** 2026-02-22
**Status:** Phase 2 complete ✅ — Mastra agents live on Replit

---

## What's Built (Current State)

### Layer 1 — Types (✅ Complete)
`src/types/agentMemory.ts`

All TypeScript contracts defined:
- `MemoryEntity`, `MemoryEntityType` — entity model
- `ContextDepth` — 4 levels: basic / wide / deep / temporal
- `ContextRequest/Response` — context assembly
- `MemorySearchRequest/Response` — BM25/semantic/hybrid search
- `OrchestratedSearchRequest/Response` — LLM-powered search
- `MemoryProcessRequest/Response` — transcript → entities
- `MemoryDiffRequest/Response` — git diffs
- `MemoryUserStatus` — health/status

### Layer 2 — API Client (✅ Complete)
`src/lib/api/mcpGatewayClient.ts` (lines 900–1048)

13 memory methods, all proxied via CF Worker `/v1/memory/*`:

| Method | Timeout | Notes |
|--------|---------|-------|
| `getMemoryHealth()` | default | no auth |
| `getMemoryStatus(userId)` | default | |
| `getMemoryContext(userId, req)` | 60s | 4-depth assembly |
| `searchMemory(userId, req)` | default | BM25 |
| `orchestratedSearchMemory(userId, req)` | 90s | LLM chain |
| `processAndCommitMemory(userId, req)` | 120s | transcript → git |
| `processMemorySession(userId, req)` | 120s | stage only |
| `commitMemorySession(userId, req)` | default | |
| `getMemoryEntity(userId, entityId)` | default | |
| `getMemoryDiff(userId, req)` | default | |
| `getMemoryTimeline(userId, opts)` | default | |
| `onboardMemoryUser(userId, req)` | 60s | |
| `syncMemory()` | default | |

### Layer 3 — Hook (✅ Complete)
`src/hooks/useAgentMemory.ts`

```typescript
const { search, getContext, processText, status, isLoading, error, refreshStatus }
  = useAgentMemory(userId)
```

- Mounted-ref pattern (no state after unmount)
- Auto-refreshes status on mount and after processText
- Error isolation per operation

### Layer 4 — UI (✅ Complete, v2)
`src/components/garden/MemoryPanel.tsx`

Sheet sidebar with 3 tabs:
- **Search** — LLM answer (ReactMarkdown) + sources with EntityViewer (expand → full content) + clickable sub-queries + auto-execute on open
- **Context** — depth selector → entity list + ReactMarkdown context preview
- **Add Memory** — textarea → entities affected + commit SHA

`src/components/garden/NoteLayout.tsx`

Memory button in note header (owner-only via `useOwnerAuth`), opens panel with note title as `initialQuery` — triggers auto-search.

### Layer 5 — Backend (✅ Phase 2 Complete — Mastra Agents Live)
`~/projects/notebooklm` on Replit

- **Storage:** isomorphic-git + local filesystem, entity path: `.git-store/src/site/notes/{type}/{name}.md`
- **Index:** wink-bm25 with wink-nlp stemming, rebuilt on entity add (fixed Phase 1 crash bug)
- **Agents:** Mastra v1.5 + `@ai-sdk/anthropic` (upgraded from raw Anthropic SDK)
  - `memory-writer` — 20 steps max, tools: read/write/search/list/commit
  - `memory-searcher` — 15 steps max, tools: read/search/list/diff
- **Routes:** `/process-transcript` → `writerAgent.generate()`, `/orchestrated-search` → `searcherAgent.generate()`
- **Tested (Phase 2):**
  - Writer: 1 transcript → 5 entities created (olena, knowledge-graph-architecture, semantic-edge-types, garden-owner, exodus-pp-ua)
  - Searcher: knowledge graph query → 5 sources returned with sub-queries
- **Auth:** Bearer `NOTEBOOKLM_SERVICE_TOKEN`

### Layer 6 — Gateway (✅ Configured)
Cloudflare Worker routes `/v1/memory/*` → Replit backend
`MEMORY_BACKEND_URL` + `NOTEBOOKLM_SERVICE_TOKEN` in CF secrets

---

## Frontend v2 (✅ Complete — 2026-02-22)

5 tasks completed by Lovable:

| Task | File | Status |
|------|------|--------|
| Auth guard on MemoryPanel | `MemoryPanel.tsx:23` — `useOwnerAuth()` | ✅ Done |
| Auto-execute `initialQuery` on open | `SearchTab` — `useEffect` + `autoSearchedRef` | ✅ Done |
| Markdown rendering in answers | `ReactMarkdown` in SearchTab + ContextTab | ✅ Done |
| Entity content viewer | `EntityViewer` component, `ChevronDown` expand | ✅ Done |
| `crypto.randomUUID()` session IDs | `useAgentMemory.ts:115` | ✅ Done |

**Note on user ID:** `useOwnerAuth` is single-owner (JWT has no userId field, only role).
`'garden-owner'` stays hardcoded but is now gated by `isAuthenticated`. Correct for MVP.
Multi-user userId from JWT is Phase 3.

---

## Known Gaps (Remaining)

| Gap | Location | Impact | Priority |
|-----|---------|--------|----------|
| Entity storage path on Replit | `.git-store/src/site/notes/` mixed with garden notes | Medium — verify isolation from public notes | Verify on new backend |
| No retry on transient failures | `useAgentMemory.ts` | Timeout = permanent error for user | Medium |
| Generic error messages | `useAgentMemory.ts` | "Search failed" gives no context | Low |
| No Timeline UI | — | `getMemoryTimeline()` defined but unused | Low (Phase 3) |
| No TanStack Query cache | — | Duplicate API calls on re-render | Low |

---

## Architecture Decisions (Locked)

1. **Git-as-memory-store** — canonical, versioned, auditable. Not a DB.
2. **Markdown entities** — human-readable, Obsidian-compatible, diff-able.
3. **BM25 first** — explainable, fast, no embedding costs for MVP.
4. **Cloudflare as auth boundary** — frontend never holds SERVICE_TOKEN.
5. **Per-user directories** — `users/{userId}/` in git repo, not branches.
6. **4-depth context** — basic/wide/deep/temporal trade cost vs completeness.
7. **`garden-owner` = single user for MVP** — multi-user is Phase 3.

---

## Phase 2 — Mastra Proper (✅ Complete — 2026-02-22)

### Goal ~~(achieved)~~
~~Replace direct Claude API calls in Replit backend with proper Mastra tool-calling agents.~~

**Done.** Both agents are live. Key implementation notes:
- Upgraded to `@ai-sdk/anthropic` (Mastra v1.5 requires AI SDK v4, not raw Anthropic SDK)
- BM25 index crash on `addDoc` post-consolidation fixed — now calls `rebuild()` instead of `consolidate()`
- Entity storage path: `.git-store/src/site/notes/{type}/{name}.md`
- `src/agents/tools.ts`, `writer-agent.ts`, `searcher-agent.ts`, `mastra.ts`, `extract-results.ts` — all created
- Singleton adapter pattern (`setAdapter` / `getAdapter`) wired in `server.ts`

### What needs to change on Replit

**Current state:**
```typescript
// process-transcript — calls Claude directly:
const result = await anthropic.messages.create({
  model: 'claude-sonnet-4-5',
  messages: [{ role: 'user', content: `Process: ${text}` }],
});
```

**Target state:**
```typescript
// process-transcript — proper Mastra agent:
const writerAgent = mastra.getAgent('memory-writer');
const result = await writerAgent.generate(text, { maxSteps: 20 });
// Agent autonomously calls: search-memory → read-memory → write-memory → commit-memory
```

### Mastra Agent Definitions

**Writer Agent** (`src/agents/writer-agent.ts` on Replit):
```typescript
tools: [readMemoryTool, writeMemoryTool, searchMemoryTool, listEntitiesTool, commitMemoryTool]
instructions: `
  You process conversation transcripts and extract structured knowledge entities.

  For each entity (person, project, concept):
  1. Search existing memory first (avoid duplicates)
  2. Read current entity content if exists
  3. Write/update with new information (preserve existing facts)
  4. Maintain ALWAYS_LOAD block: 5-7 key facts maximum
  5. After all updates, commit with descriptive message

  Entity IDs: people/{name}, projects/{name}, concepts/{name}
  Date format in interactions: ISO 8601
`
```

**Searcher Agent** (`src/agents/searcher-agent.ts` on Replit):
```typescript
tools: [readMemoryTool, searchMemoryTool, listEntitiesTool, diffMemoryTool]
instructions: `
  You answer questions by searching the knowledge base.

  1. Generate 1-3 focused sub-queries from user question
  2. Search memory for each sub-query
  3. Read full content of top 3 matches
  4. For temporal questions ("how has X changed"), use diff-memory
  5. Synthesize answer with specific citations to entity IDs

  Always return: answer text + sources array with entityId + score
`
```

### Tool Adapter Injection Pattern

```typescript
// src/agents/tools.ts — on Replit
import { createTool } from '@mastra/core';
import { getAdapter } from '../memory/adapter.js'; // singleton getter

export const searchMemoryTool = createTool({
  id: 'search-memory',
  inputSchema: z.object({ query: z.string(), k: z.number().default(10) }),
  execute: async ({ context }) => {
    const adapter = getAdapter(); // injected singleton
    return adapter.search(context.query, context.k);
  },
});
```

### Route Changes

```typescript
// /v1/memory/:userId/process-transcript
const writerAgent = mastra.getAgent('memory-writer');
const result = await writerAgent.generate(
  `Process this input for user ${userId}: ${memoryInput}`,
  { maxSteps: 20 }
);
return {
  success: true,
  sessionId,
  entitiesAffected: extractEntitiesFromToolCalls(result.toolCalls),
  commitSha: extractCommitSha(result.toolCalls),
};

// /v1/memory/:userId/orchestrated-search
const searcherAgent = mastra.getAgent('memory-searcher');
const result = await searcherAgent.generate(lastMessage, { maxSteps: 15 });
return {
  success: true,
  answer: result.text,
  subQueries: extractSubQueries(result),
  sources: extractSources(result.toolCalls),
};
```

---

## Phase 3 — Advanced (Future)

| Feature | Prerequisite | Complexity |
|---------|-------------|-----------|
| Vector/semantic search | Embedding API + vector store | High |
| Multi-user support | Auth refactor (userId from JWT) | Medium |
| Entity viewer component (frontend) | None | Low |
| Timeline UI (frontend) | None | Low |
| Memory ↔ Graph integration | Graph snapshot update | Medium |
| GitHub sync UI | GITHUB_PAT set in CF secrets | Low |
| Auto-context in chat | Chat component integration | Medium |
| TanStack Query cache in hook | None | Low |

---

## Replit Prompt for Phase 2

Send to Replit Agent after Phase 1 is stable:

```
The memory backend is running. Now implement proper Mastra agents.

Current state: process-transcript and orchestrated-search use direct Claude API calls.
Goal: Replace with Mastra tool-calling agents.

Read docs/memory/03_MASTRA_AGENTS_CONFIG.md for full agent specs.
Read docs/memory/REPLIT_IMPLEMENTATION_GUIDE.md §5.7 for tool context injection.

Steps:
1. Create src/agents/tools.ts with 5 tools:
   read-memory, write-memory, search-memory, list-entities, commit-memory
   (inject memoryAdapter via singleton getter)

2. Create src/agents/writer-agent.ts (Mastra Agent, model: claude-sonnet-4-5)
   Tools: read, write, search, list, commit
   maxSteps: 20

3. Create src/agents/searcher-agent.ts (Mastra Agent, model: claude-sonnet-4-5)
   Tools: read, search, list, diff
   maxSteps: 15

4. Create src/mastra.ts — Mastra instance with both agents

5. Update routes/memory.ts:
   - /process-transcript → writerAgent.generate()
   - /orchestrated-search → searcherAgent.generate()
   - Extract entities from toolCalls in response

Test:
POST /v1/memory/garden-owner/process-transcript
{"memoryInput":"Met with Olena today. Discussed the knowledge graph architecture for exodus.pp.ua. She suggested adding semantic edge types to the graph contract.","sessionId":"test-mastra-001","autoCommit":true}

Expected: Agent makes 3-5 tool calls, creates/updates entities, returns commitSha
```
