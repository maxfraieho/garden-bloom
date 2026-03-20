/**
 * Agent Memory Types — DiffMem-like git-based memory for AI agents.
 *
 * Aligned with real backend (bacand) contracts:
 * - Memory = versioned Markdown files in git repo
 * - Current state (files) separated from history (git commits)
 * - BM25 search over current state
 * - Git diffs for temporal reasoning
 * - History not indexed in frontend
 */

// ============================================
// Memory Entity Types
// ============================================

/** Memory entity — a single Markdown file in the memory repo */
export interface MemoryEntity {
  id: string;
  title: string;
  content: string;
  aliases: string[];
  links: string[];
  backlinks: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  meta: Record<string, unknown>;
}

/** Entity summary (from list endpoint) */
export interface MemoryEntitySummary {
  id: string;
  title: string;
  tags: string[];
  updatedAt: string;
}

export type MemoryEntityType =
  | 'person'
  | 'project'
  | 'concept'
  | 'timeline'
  | 'session'
  | 'artifact'
  | 'note'
  | 'custom';

// ============================================
// Context Assembly Types
// ============================================

/**
 * Context depth — mirrors backend's 4-level depth model:
 * - surface: Top entities, truncated content (first 500 chars)
 * - wide: Search-first, multiple entities, present-state only (default)
 * - deep: Full entity content + deep graph traversal, present-state only
 * - temporal: deep + on-demand history attachments
 */
export type ContextDepth = 'surface' | 'wide' | 'deep' | 'temporal';

/** Context request for POST /v1/memory/context */
export interface ContextRequest {
  query: string;
  depth?: ContextDepth;
  maxDepth?: number;
  maxTokens?: number;
  /** Only relevant for depth=temporal */
  historyLimit?: number;
}

/** Backend ContextGraph shape */
export interface ContextGraph {
  root: string;
  nodes: ContextNode[];
  totalTokens: number;
  /** Only present when depth=temporal */
  temporalAttachments?: TemporalAttachment[];
}

export interface ContextNode {
  entity: MemoryEntity;
  depth: number;
  relevance: number;
}

export interface TemporalAttachment {
  entityId: string;
  history: HistoryEntry[];
}

// ============================================
// Search Types
// ============================================

/** Search result from GET /v1/memory/search?q=&limit= */
export interface MemorySearchResult {
  id: string;
  title: string;
  score: number;
  snippet: string;
}

export interface MemorySearchResponse {
  results: MemorySearchResult[];
}

// ============================================
// History / Diff / Revision Types (Temporal Layer)
// ============================================

/** Single history entry from GET /v1/memory/entities/:id/history */
export interface HistoryEntry {
  sha: string;
  timestamp: string;
  message: string;
  author: string;
}

/** Response from GET /v1/memory/entities/:id/history */
export interface EntityHistoryResponse {
  entityId: string;
  history: HistoryEntry[];
  count: number;
}

/** Response from GET /v1/memory/entities/:id/diff?from=&to= */
export interface EntityDiffResponse {
  entityId: string;
  from: string | null;
  to: string;
  diff: {
    patch: string;
    additions: number;
    deletions: number;
  };
}

/** Response from GET /v1/memory/entities/:id/revisions/:sha */
export interface RevisionSnapshotResponse {
  entityId: string;
  sha: string;
  content: string;
}

// ============================================
// Write / Process Types
// ============================================

export interface MemoryProcessRequest {
  memoryInput: string;
  sessionId?: string;
  autoCommit?: boolean;
  instructions?: string;
}

export interface MemoryProcessResponse {
  success: true;
  sessionId: string;
  entitiesAffected: Array<{
    entityId: string;
    action: 'created' | 'updated';
    name: string;
  }>;
  commitSha?: string;
}

// ============================================
// User / Status Types
// ============================================

export interface MemoryUserStatus {
  ok: boolean;
  initialized: boolean;
  entityCount: number;
}

// ============================================
// Orchestrated Search (LLM-powered)
// ============================================

export interface OrchestratedSearchRequest {
  conversation?: Array<{ role: string; content: string }>;
  query?: string;
  k?: number;
}

export interface OrchestratedSearchResponse {
  success: true;
  answer: string;
  subQueries: string[];
  sources: MemorySearchResult[];
}

// ============================================
// Writer Staging Types
// ============================================

export type WriterStageStatus = 'idle' | 'staged' | 'committing' | 'committed' | 'error';

export interface WriterSessionState {
  sessionId: string;
  status: WriterStageStatus;
  entitiesAffected: Array<{ entityId: string; action: string; name: string }>;
  commitSha?: string;
  error?: string;
}

// ============================================
// Agent Memory Config
// ============================================

export interface AgentMemoryConfig {
  memoryBaseUrl?: string;
  userId: string;
  defaultDepth: ContextDepth;
  defaultSearchMethod: 'bm25';
  autoSync: boolean;
  syncIntervalMs: number;
}
