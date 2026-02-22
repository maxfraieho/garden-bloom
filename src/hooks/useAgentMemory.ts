import { useState, useCallback, useEffect, useRef } from 'react';
import type {
  ContextDepth,
  ContextResponse,
  MemorySearchResponse,
  MemoryProcessResponse,
  MemoryUserStatus,
  OrchestratedSearchResponse,
} from '@/types/agentMemory';
import {
  orchestratedSearchMemory,
  getMemoryContext,
  processAndCommitMemory,
  getMemoryStatus,
} from '@/lib/api/mcpGatewayClient';

interface UseAgentMemoryReturn {
  /** Orchestrated LLM-powered search */
  search: (query: string) => Promise<OrchestratedSearchResponse>;
  /** Assemble context at given depth */
  getContext: (depth: ContextDepth, query?: string) => Promise<ContextResponse>;
  /** Process raw text into memory entities */
  processText: (text: string, sessionId?: string) => Promise<MemoryProcessResponse>;
  /** Memory backend status */
  status: MemoryUserStatus | null;
  /** Whether any memory operation is in flight */
  isLoading: boolean;
  /** Last error message */
  error: string | null;
  /** Refresh status from backend */
  refreshStatus: () => Promise<void>;
}

export function useAgentMemory(userId: string): UseAgentMemoryReturn {
  const [status, setStatus] = useState<MemoryUserStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const refreshStatus = useCallback(async () => {
    try {
      const data = await getMemoryStatus(userId);
      if (mountedRef.current) {
        setStatus(data);
        setError(null);
      }
    } catch (err: unknown) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch memory status');
      }
    }
  }, [userId]);

  // Load status on mount
  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  const search = useCallback(async (query: string): Promise<OrchestratedSearchResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await orchestratedSearchMemory(userId, {
        conversation: [{ role: 'user', content: query }],
      });
      return result;
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Search failed';
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  const getContextFn = useCallback(async (
    depth: ContextDepth,
    query?: string
  ): Promise<ContextResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getMemoryContext(userId, {
        conversation: [{ role: 'user', content: query || 'Load context' }],
        depth,
      });
      return result;
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Context fetch failed';
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId]);

  const processText = useCallback(async (
    text: string,
    sessionId?: string
  ): Promise<MemoryProcessResponse> => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await processAndCommitMemory(userId, {
        memoryInput: text,
        sessionId: sessionId || `session-${Date.now()}`,
        autoCommit: true,
      });
      // Refresh status after processing
      refreshStatus();
      return result;
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? (err as { message: string }).message
        : 'Processing failed';
      if (mountedRef.current) setError(msg);
      throw err;
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [userId, refreshStatus]);

  return {
    search,
    getContext: getContextFn,
    processText,
    status,
    isLoading,
    error,
    refreshStatus,
  };
}
