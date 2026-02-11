// MCP Session Management Hook
// Architecture: Browser → Cloudflare Worker (CORS) → MinIO (storage)
// Auth: JWT token from useOwnerAuth for protected endpoints

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { getOwnerToken } from './useOwnerAuth';

export interface MCPNote {
  slug: string;
  title: string;
  tags: string[];
  content: string;
}

export interface MCPSession {
  sessionId: string;
  endpoint: string;
  expiresAt: Date;
  folders: string[];
  noteCount: number;
  createdAt: Date;
  formats?: {
    json: string;
    markdown: string;
    jsonl: string;
  };
}

interface CreateSessionResponse {
  success: boolean;
  sessionId: string;
  sessionUrl: string;
  expiresAt: string;
  noteCount: number;
  storage: 'minio' | 'kv';
  formats: {
    json: string;
    markdown: string;
    jsonl: string;
  };
}

const STORAGE_KEY = 'mcp-active-sessions';

/**
 * Single gateway endpoint - Cloudflare Worker handles CORS and storage
 */
const MCP_GATEWAY_URL = import.meta.env.VITE_MCP_GATEWAY_URL || 'https://garden-mcp-server.maxfraieho.workers.dev';

/**
 * Debug mode - set to true to see detailed logs in console
 */
const DEBUG_MCP = true;

/**
 * POST to Cloudflare Worker with optional JWT auth
 */
async function postToGateway(
  path: string, 
  payload: unknown,
  requireAuth = false
): Promise<Response> {
  const url = `${MCP_GATEWAY_URL}${path}`;
  const body = JSON.stringify(payload);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Add JWT token for protected endpoints
  if (requireAuth) {
    const token = getOwnerToken();
    if (!token) {
      throw new Error('Authentication required. Please login first.');
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (DEBUG_MCP) {
    console.log('[MCP] POST to gateway:', url);
    console.log('[MCP] Payload size:', body.length, 'bytes');
    console.log('[MCP] Auth required:', requireAuth);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body,
  });

  if (DEBUG_MCP) {
    console.log('[MCP] Response status:', response.status);
  }

  // Handle auth errors specifically
  if (response.status === 401) {
    throw new Error('Unauthorized. Please login again.');
  }

  return response;
}

function loadSessionsFromStorage(): MCPSession[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((s: any) => ({
      ...s,
      expiresAt: new Date(s.expiresAt),
      createdAt: new Date(s.createdAt),
    })).filter((s: MCPSession) => new Date() < s.expiresAt);
  } catch {
    return [];
  }
}

function saveSessionsToStorage(sessions: MCPSession[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function useMCPSessions() {
  const [sessions, setSessions] = useState<MCPSession[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);

  // Load sessions on mount
  useEffect(() => {
    setSessions(loadSessionsFromStorage());
  }, []);

  // Save sessions when they change
  useEffect(() => {
    saveSessionsToStorage(sessions);
  }, [sessions]);

  // Remove expired sessions every minute
  useEffect(() => {
    const interval = setInterval(() => {
      setSessions(prev => prev.filter(s => new Date() < s.expiresAt));
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  const createSession = useCallback(async (
    folders: string[], 
    ttlMinutes: number,
    notes: MCPNote[] = []
  ): Promise<MCPSession | null> => {
    if (folders.length === 0) {
      toast.error('Оберіть хоча б одну папку');
      return null;
    }

    if (ttlMinutes < 5 || ttlMinutes > 1440) {
      toast.error('TTL повинен бути від 5 до 1440 хвилин');
      return null;
    }

    setIsCreating(true);
    setCreationError(null);

    try {
      const payload = {
        folders,
        ttlMinutes,
        notes, // Include notes content for snapshot
        userId: 'web-user',
        metadata: {
          source: 'web-ui',
          version: '2.0',
          timestamp: new Date().toISOString(),
        },
      };

      // 🔐 Protected endpoint - requires owner JWT
      const response = await postToGateway('/sessions/create', payload, true);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data: CreateSessionResponse = await response.json();

      const newSession: MCPSession = {
        sessionId: data.sessionId,
        endpoint: data.sessionUrl,
        expiresAt: new Date(data.expiresAt),
        folders,
        noteCount: data.noteCount,
        createdAt: new Date(),
        formats: data.formats,
      };

      setSessions(prev => [...prev, newSession]);

      toast.success('✅ MCP доступ створено', {
        description: `${data.noteCount} нотаток • ${ttlMinutes} хв`,
      });

      return newSession;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Невідома помилка';
      setCreationError(message);
      toast.error('❌ Помилка створення MCP доступу', {
        description: message,
      });
      return null;
    } finally {
      setIsCreating(false);
    }
  }, []);

  const revokeSession = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      // 🔐 Protected endpoint - requires owner JWT
      const response = await postToGateway('/sessions/revoke', { sessionId }, true);

      if (!response.ok) {
        throw new Error('Не вдалося відкликати сесію');
      }

      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));

      toast.success('🗑️ MCP доступ видалено', {
        description: 'Сесію відкликано',
      });

      return true;
    } catch (error) {
      // Even if revoke fails on server, remove locally
      setSessions(prev => prev.filter(s => s.sessionId !== sessionId));
      
      toast.warning('⚠️ Сесію видалено локально', {
        description: 'Можливо, сервер недоступний',
      });
      
      return false;
    }
  }, []);

  const copyEndpoint = useCallback((endpoint: string) => {
    navigator.clipboard.writeText(endpoint);
    toast.success('📋 URL скопійовано');
  }, []);

  return {
    sessions,
    isCreating,
    creationError,
    createSession,
    revokeSession,
    copyEndpoint,
  };
}
