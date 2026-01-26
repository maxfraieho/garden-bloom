import type {
  ApiError,
  CreateZoneRequest,
  CreateZoneResponse,
  NotebookLMJobStatus,
  NotebookLMMapping,
} from '@/types/mcpGateway';
import { pushApiError } from './apiErrorStore';
import { getOwnerToken } from '@/hooks/useOwnerAuth';

const DEFAULT_GATEWAY = 'https://garden-mcp-server.maxfraieho.workers.dev';

export function getGatewayBaseUrl() {
  return import.meta.env.VITE_MCP_GATEWAY_URL || DEFAULT_GATEWAY;
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
    const message = resOrErr instanceof Error ? resOrErr.message : 'Network error';
    const err: ApiError = { message };
    pushApiError(err);
    return err;
  }

  const res = resOrErr;
  const data = await safeJson(res);

  // Worker legacy: { success:false, error:"..." }
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string') {
      const err: ApiError = { message: data.error, httpStatus: res.status };
      pushApiError(err);
      return err;
    }

    // Worker/UI-adapter style: { success:false, error:{code,message,details} }
    if (data.error && typeof data.error === 'object') {
      const err: ApiError = {
        message: data.error.message || res.statusText || 'Request failed',
        code: data.error.code,
        details: data.error.details,
        httpStatus: res.status,
      };
      pushApiError(err);
      return err;
    }
  }

  const fallback: ApiError = {
    message: res.statusText || 'Request failed',
    httpStatus: res.status,
    details: data,
  };
  pushApiError(fallback);
  return fallback;
}

async function requestJson<T>(
  path: string,
  init: RequestInit & { requireAuth?: boolean } = {}
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
      const err: ApiError = { message: 'Authentication required', code: 'AUTH_REQUIRED' };
      pushApiError(err);
      throw err;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw await parseError(res);
  }
  const data = await safeJson(res);
  return data as T;
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

export async function pingHealth(): Promise<{ ok: boolean } | any> {
  return requestJson<any>('/health', { method: 'GET' });
}
