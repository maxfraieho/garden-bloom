import type {
  ApiError,
  GatewayErrorCode,
  CreateZoneRequest,
  CreateZoneResponse,
  NotebookLMChatRequest,
  NotebookLMChatResponse,
  NotebookLMJobStatus,
  NotebookLMMapping,
} from '@/types/mcpGateway';
import { pushApiError } from './apiErrorStore';
import { getOwnerToken } from '@/hooks/useOwnerAuth';

const DEFAULT_GATEWAY = 'https://garden-mcp-server.maxfraieho.workers.dev';
const REQUEST_TIMEOUT_MS = 30000;

export function getGatewayBaseUrl() {
  return import.meta.env.VITE_MCP_GATEWAY_URL || DEFAULT_GATEWAY;
}

// Human-friendly error messages
const ERROR_MESSAGES: Record<GatewayErrorCode, string> = {
  NETWORK_OFFLINE: "No internet connection. Check your network and try again.",
  TIMEOUT: "Request timed out. Please try again.",
  AUTH_REQUIRED: "Please log in to continue.",
  UNAUTHORIZED: "Session expired. Please log in again.",
  FORBIDDEN: "You do not have permission to access this resource.",
  ZONE_EXPIRED: "This zone has expired. Contact the owner for a new link.",
  ZONE_NOT_FOUND: "Zone not found. It may have been deleted.",
  NOT_FOUND: "The requested resource was not found.",
  RATE_LIMITED: "Too many requests. Please wait a moment.",
  SERVER_ERROR: "Something went wrong on our end. Please try again later.",
  BAD_REQUEST: "Invalid request. Please check your input.",
  UNKNOWN: "An unexpected error occurred. Please try again.",
};

// Whether the error is retryable
const RETRYABLE_CODES: Set<GatewayErrorCode> = new Set([
  'NETWORK_OFFLINE',
  'TIMEOUT',
  'RATE_LIMITED',
  'SERVER_ERROR',
]);

function createApiError(
  code: GatewayErrorCode,
  httpStatus?: number,
  details?: unknown,
  customMessage?: string
): ApiError {
  return {
    code,
    message: customMessage || ERROR_MESSAGES[code],
    httpStatus,
    details,
    retryable: RETRYABLE_CODES.has(code),
  };
}

function mapHttpStatusToCode(status: number, serverCode?: string): GatewayErrorCode {
  // Check server-provided codes first
  if (serverCode) {
    const upper = serverCode.toUpperCase();
    if (upper.includes('ZONE_EXPIRED') || upper.includes('EXPIRED')) return 'ZONE_EXPIRED';
    if (upper.includes('ZONE_NOT_FOUND')) return 'ZONE_NOT_FOUND';
    if (upper.includes('NOT_AUTHENTICATED') || upper.includes('AUTH')) return 'AUTH_REQUIRED';
    if (upper.includes('RATE_LIMIT')) return 'RATE_LIMITED';
  }

  switch (status) {
    case 400:
      return 'BAD_REQUEST';
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 410: // Gone - often used for expired resources
      return 'ZONE_EXPIRED';
    case 429:
      return 'RATE_LIMITED';
    default:
      if (status >= 500) return 'SERVER_ERROR';
      return 'UNKNOWN';
  }
}

async function safeJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function parseError(resOrErr: Response | unknown): Promise<ApiError> {
  // Network / thrown error
  if (!(resOrErr instanceof Response)) {
    const errObj = resOrErr instanceof Error ? resOrErr : null;
    const errMessage = errObj?.message?.toLowerCase() || '';

    // Detect specific error types
    if (errMessage.includes('timeout') || errMessage.includes('aborted')) {
      const err = createApiError('TIMEOUT');
      pushApiError(err);
      return err;
    }

    if (
      errMessage.includes('network') ||
      errMessage.includes('fetch') ||
      errMessage.includes('failed to fetch') ||
      errMessage.includes('offline') ||
      !navigator.onLine
    ) {
      const err = createApiError('NETWORK_OFFLINE');
      pushApiError(err);
      return err;
    }

    // Generic network error
    const err = createApiError('UNKNOWN', undefined, errObj?.message);
    pushApiError(err);
    return err;
  }

  const res = resOrErr;
  const data = await safeJson(res);

  // Extract server error code/message
  let serverCode: string | undefined;
  let serverMessage: string | undefined;

  if (data && typeof data === 'object') {
    // { success:false, error:"..." }
    if (typeof data.error === 'string') {
      serverMessage = data.error;
    }
    // { success:false, error:{code,message,details} }
    if (data.error && typeof data.error === 'object') {
      serverCode = data.error.code;
      serverMessage = data.error.message;
    }
    // Direct code on response
    if (data.code) {
      serverCode = data.code;
    }
  }

  const code = mapHttpStatusToCode(res.status, serverCode);

  // Use server message if it's user-friendly, otherwise use our mapping
  const isFriendlyMessage =
    serverMessage &&
    !serverMessage.includes('Error:') &&
    !serverMessage.includes('Exception') &&
    serverMessage.length < 150;

  const err = createApiError(
    code,
    res.status,
    data,
    isFriendlyMessage ? serverMessage : undefined
  );

  pushApiError(err);
  return err;
}

async function requestJson<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean; timeoutMs?: number } = {}
): Promise<T> {
  const baseUrl = getGatewayBaseUrl();
  const url = `${baseUrl}${path}`;
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string> | undefined),
  };

  if (!headers['Content-Type'] && init.method && init.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (init.requireAuth) {
    const token = getOwnerToken();
    if (!token) {
      const err = createApiError('AUTH_REQUIRED');
      pushApiError(err);
      throw err;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Add timeout via AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    init.timeoutMs || REQUEST_TIMEOUT_MS
  );

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      throw await parseError(res);
    }

    const data = await safeJson(res);
    return data as T;
  } catch (err) {
    clearTimeout(timeoutId);

    // Already parsed ApiError
    if (err && typeof err === 'object' && 'code' in err && 'retryable' in err) {
      throw err;
    }

    // AbortError = timeout
    if (err instanceof Error && err.name === 'AbortError') {
      const timeoutErr = createApiError('TIMEOUT');
      pushApiError(timeoutErr);
      throw timeoutErr;
    }

    // Parse other errors
    throw await parseError(err);
  }
}

export async function createZone(payload: CreateZoneRequest): Promise<CreateZoneResponse> {
  return requestJson<CreateZoneResponse>('/zones/create', {
    method: 'POST',
    body: JSON.stringify(payload),
    requireAuth: true,
  });
}

export async function getZoneNotebookLMStatus(zoneId: string): Promise<{ notebooklm: NotebookLMMapping | null }> {
  return requestJson<{ notebooklm: NotebookLMMapping | null }>(`/zones/${zoneId}/notebooklm`, {
    method: 'GET',
  });
}

export async function getNotebookLMJobStatus(
  zoneId: string,
  jobId: string
): Promise<NotebookLMJobStatus> {
  return requestJson<NotebookLMJobStatus>(`/zones/${zoneId}/notebooklm/job/${jobId}`, {
    method: 'GET',
  });
}

export async function retryNotebookLMImport(zoneId: string): Promise<{ notebooklm: NotebookLMMapping }> {
  return requestJson<{ notebooklm: NotebookLMMapping }>(`/zones/${zoneId}/notebooklm/retry-import`, {
    method: 'POST',
    body: JSON.stringify({}),
    requireAuth: true,
  });
}

export async function chatNotebookLM(payload: NotebookLMChatRequest): Promise<NotebookLMChatResponse> {
  return requestJson<NotebookLMChatResponse>('/notebooklm/chat', {
    method: 'POST',
    body: JSON.stringify(payload),
    requireAuth: true,
  });
}

export async function pingHealth(): Promise<{ ok: boolean } | any> {
  return requestJson<any>('/health', { method: 'GET' });
}

export async function getAuthStatus(): Promise<{
  success: true;
  initialized: boolean;
  notebookLMReady?: boolean;
  notebookLMMessage?: string | null;
  notebookCount?: number | null;
} | any> {
  return requestJson<any>('/auth/status', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

// ============================================
// Chats API
// ============================================

export interface ChatListItem {
  chatId: string;
  title: string;
  zoneId: string | null;
  zoneName: string | null;
  notebookUrl: string | null;
  lastMessagePreview: string | null;
  lastMessageAt: number;
  unreadCount: number;
  status: 'active' | 'archived';
  accessType: 'web' | 'mcp' | 'both';
  expiresAt: number | null;
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
}

export interface ChatsListResponse {
  success: true;
  chats: ChatListItem[];
  total: number;
  zoneId?: string;
  zoneName?: string;
}

export async function getRecentChats(options?: {
  limit?: number;
  status?: 'active' | 'archived' | 'all';
}): Promise<ChatsListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);
  
  const query = params.toString();
  return requestJson<ChatsListResponse>(`/v1/chats/recent${query ? `?${query}` : ''}`, {
    method: 'GET',
    requireAuth: true,
  });
}

export async function getZoneChats(
  zoneId: string,
  options?: {
    limit?: number;
    status?: 'active' | 'archived' | 'all';
    zoneCode?: string;
  }
): Promise<ChatsListResponse> {
  const params = new URLSearchParams();
  if (options?.limit) params.set('limit', String(options.limit));
  if (options?.status) params.set('status', options.status);

  const query = params.toString();
  const headers: Record<string, string> = {};
  
  // Guest access via zone code
  if (options?.zoneCode) {
    headers['X-Zone-Code'] = options.zoneCode;
  }

  return requestJson<ChatsListResponse>(`/v1/zones/${zoneId}/chats${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers,
  });
}

export async function createServerChat(data: {
  title: string;
  zoneId?: string;
  zoneName?: string;
  notebookUrl?: string;
  accessType?: 'web' | 'mcp' | 'both';
  expiresAt?: number;
}): Promise<{ success: true; chat: ChatListItem }> {
  return requestJson<{ success: true; chat: ChatListItem }>('/v1/chats', {
    method: 'POST',
    body: JSON.stringify(data),
    requireAuth: true,
  });
}

export async function touchChat(
  chatId: string,
  data: {
    lastMessagePreview?: string;
    lastMessageAt?: number;
    unreadCount?: number;
  }
): Promise<{ success: true; chat: ChatListItem }> {
  return requestJson<{ success: true; chat: ChatListItem }>(`/v1/chats/${chatId}/touch`, {
    method: 'POST',
    body: JSON.stringify(data),
    requireAuth: true,
  });
}

export async function patchChat(
  chatId: string,
  data: {
    pinned?: boolean;
    status?: 'active' | 'archived';
    unreadCount?: number;
    title?: string;
  }
): Promise<{ success: true; chat: ChatListItem }> {
  return requestJson<{ success: true; chat: ChatListItem }>(`/v1/chats/${chatId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
    requireAuth: true,
  });
}

// ============================================
// Edit Proposals API
// ============================================

import type { EditProposal, CreateProposalRequest, ProposalsListResponse } from '@/types/mcpGateway';

export async function createProposal(
  zoneId: string,
  zoneCode: string,
  payload: CreateProposalRequest
): Promise<{ success: true; proposal: EditProposal }> {
  return requestJson<{ success: true; proposal: EditProposal }>(`/zones/${zoneId}/proposals`, {
    method: 'POST',
    body: JSON.stringify(payload),
    headers: {
      'X-Zone-Code': zoneCode,
    },
  });
}

export async function getZoneProposals(
  zoneId: string,
  options?: { status?: 'pending' | 'accepted' | 'rejected' | 'all'; zoneCode?: string }
): Promise<ProposalsListResponse> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  
  const query = params.toString();
  const headers: Record<string, string> = {};
  if (options?.zoneCode) {
    headers['X-Zone-Code'] = options.zoneCode;
  }
  
  return requestJson<ProposalsListResponse>(`/zones/${zoneId}/proposals${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers,
  });
}

export async function getPendingProposals(limit?: number): Promise<ProposalsListResponse> {
  const params = new URLSearchParams();
  if (limit) params.set('limit', String(limit));
  
  const query = params.toString();
  return requestJson<ProposalsListResponse>(`/proposals/pending${query ? `?${query}` : ''}`, {
    method: 'GET',
    requireAuth: true,
  });
}

export async function getProposal(
  proposalId: string,
  zoneCode?: string
): Promise<{ success: true; proposal: EditProposal }> {
  const headers: Record<string, string> = {};
  if (zoneCode) {
    headers['X-Zone-Code'] = zoneCode;
  }
  
  return requestJson<{ success: true; proposal: EditProposal }>(`/proposals/${proposalId}`, {
    method: 'GET',
    headers,
  });
}

export async function acceptProposal(
  proposalId: string
): Promise<{ success: true; proposal: EditProposal }> {
  return requestJson<{ success: true; proposal: EditProposal }>(`/proposals/${proposalId}/accept`, {
    method: 'POST',
    body: JSON.stringify({}),
    requireAuth: true,
  });
}

export async function rejectProposal(
  proposalId: string
): Promise<{ success: true; proposal: EditProposal }> {
  return requestJson<{ success: true; proposal: EditProposal }>(`/proposals/${proposalId}/reject`, {
    method: 'POST',
    body: JSON.stringify({}),
    requireAuth: true,
  });
}
