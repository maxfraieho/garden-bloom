import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ContextDepth,
  ContextGraph,
  OrchestratedSearchResponse,
  MemoryProcessResponse,
  MemoryUserStatus,
  EntityHistoryResponse,
  EntityDiffResponse,
  RevisionSnapshotResponse,
} from '@/types/agentMemory';
import {
  orchestratedSearchMemory,
  getMemoryContextByQuery,
  processTranscript,
  getMemoryHealth,
  getEntityHistory,
  getEntityDiff,
  getEntityRevision,
} from '@/lib/api/mcpGatewayClient';

/** Which operation is currently loading */
export type LoadingOp =
  | null
  | 'search'
  | 'context'
  | 'process'
  | 'history'
  | 'diff'
  | 'revision'
  | 'status';

interface UseAgentMemoryReturn {
  search: (query: string) => Promise<OrchestratedSearchResponse>;
  getContext: (depth: ContextDepth, query?: string) => Promise<ContextGraph>;
  processText: (text: string, sessionId?: string) => Promise<MemoryProcessResponse>;
  fetchHistory: (entityId: string, options?: { limit?: number; since?: string; until?: string }) => Promise<EntityHistoryResponse>;
  fetchDiff: (entityId: string, toSha: string, fromSha?: string) => Promise<EntityDiffResponse>;
  fetchRevision: (entityId: string, sha: string) => Promise<RevisionSnapshotResponse>;
  status: MemoryUserStatus | null;
  /** Backward-compat: true when any op is in flight */
  isLoading: boolean;
  /** Which specific operation is loading */
  loadingOp: LoadingOp;
  error: string | null;
  refreshStatus: () => Promise<void>;
  /** Cached history responses */
  historyCache: Map<string, EntityHistoryResponse>;
}

function extractMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return (err as { message: string }).message;
  return fallback;
}

export function useAgentMemory(userId: string): UseAgentMemoryReturn {
  const [status, setStatus] = useState<MemoryUserStatus | null>(null);
  const [loadingOp, setLoadingOp] = useState<LoadingOp>(null);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const historyCacheRef = useRef<Map<string, EntityHistoryResponse>>(new Map());

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getMemoryHealth();
      if (mountedRef.current) {
        setStatus(data);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(extractMessage(err, 'Failed to fetch memory status'));
      }
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const search = useCallback(async (query: string): Promise<OrchestratedSearchResponse> => {
    setLoadingOp('search');
    setError(null);
    try {
      return await orchestratedSearchMemory(userId, {
        conversation: [{ role: 'user', content: query }],
      });
    } catch (err: unknown) {
      const msg = extractMessage(err, 'Search failed');
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setLoadingOp(null);
    }
  }, [userId]);

  const getContextFn = useCallback(async (
    depth: ContextDepth,
    query?: string
  ): Promise<ContextGraph> => {
    setLoadingOp('context');
    setError(null);
    try {
      return await getMemoryContextByQuery({
        query: query || 'Load context',
        depth,
      });
    } catch (err: unknown) {
      const msg = extractMessage(err, 'Context fetch failed');
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setLoadingOp(null);
    }
  }, []);

  const processText = useCallback(async (
    text: string,
    sessionId?: string
  ): Promise<MemoryProcessResponse> => {
    setLoadingOp('process');
    setError(null);
    try {
      const result = await processTranscript(userId, {
        memoryInput: text,
        sessionId: sessionId || `session-${crypto.randomUUID()}`,
        autoCommit: true,
      });
      refreshStatus();
      return result;
    } catch (err: unknown) {
      const msg = extractMessage(err, 'Processing failed');
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setLoadingOp(null);
    }
  }, [userId, refreshStatus]);

  const fetchHistory = useCallback(async (
    entityId: string,
    options?: { limit?: number; since?: string; until?: string }
  ): Promise<EntityHistoryResponse> => {
    // Build cache key from entityId + options
    const cacheKey = `${entityId}:${options?.limit || ''}:${options?.since || ''}:${options?.until || ''}`;
    const cached = historyCacheRef.current.get(cacheKey);
    if (cached) return cached;

    setLoadingOp('history');
    setError(null);
    try {
      const data = await getEntityHistory(entityId, options);
      historyCacheRef.current.set(cacheKey, data);
      return data;
    } catch (err: unknown) {
      const msg = extractMessage(err, 'History fetch failed');
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setLoadingOp(null);
    }
  }, []);

  const fetchDiff = useCallback(async (
    entityId: string,
    toSha: string,
    fromSha?: string
  ): Promise<EntityDiffResponse> => {
    setLoadingOp('diff');
    setError(null);
    try {
      return await getEntityDiff(entityId, toSha, fromSha);
    } catch (err: unknown) {
      const msg = extractMessage(err, 'Diff fetch failed');
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setLoadingOp(null);
    }
  }, []);

  const fetchRevision = useCallback(async (
    entityId: string,
    sha: string
  ): Promise<RevisionSnapshotResponse> => {
    setLoadingOp('revision');
    setError(null);
    try {
      return await getEntityRevision(entityId, sha);
    } catch (err: unknown) {
      const msg = extractMessage(err, 'Revision fetch failed');
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setLoadingOp(null);
    }
  }, []);

  return {
    search,
    getContext: getContextFn,
    processText,
    fetchHistory,
    fetchDiff,
    fetchRevision,
    status,
    isLoading: loadingOp !== null,
    loadingOp,
    error,
    refreshStatus,
    historyCache: historyCacheRef.current,
  };
}
