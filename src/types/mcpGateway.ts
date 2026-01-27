export type AccessType = 'web' | 'mcp' | 'both';

export type NotebookLMStatus =
  | 'not_created'
  | 'queued'
  | 'created'
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
  httpStatus?: number;
}

export interface NotebookLMMapping {
  notebookId: string | null;
  notebookUrl: string | null;
  importJobId: string | null;
  status: NotebookLMStatus;
  createdAt?: number | null;
  lastError?: string | null;
}

export interface NotebookLMJobStatus {
  jobId?: string;
  status: Exclude<NotebookLMStatus, 'not_created'>;
  progress?: number | null; // 0..100
  current_step?: number | null;
  total_steps?: number | null;
  notebook_url?: string | null;
  error?: string | null;
  results?: Array<{
    source?: {
      type?: string;
      bucket?: string | null;
      key?: string | null;
      url?: string | null;
    } | null;
    status?: string | null;
    source_id?: string | null;
    error?: string | null;
    retries?: number | null;
  }> | null;
}

export type NotebookLMChatKind = 'answer' | 'summary' | 'study_guide' | 'flashcards';

export interface NotebookLMChatRequest {
  notebookUrl: string;
  message: string;
  kind?: NotebookLMChatKind;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export interface NotebookLMChatResponse {
  success: true;
  answer: string;
  // Optional extra fields from backend (future-proof)
  citations?: Array<{ title?: string; url?: string; snippet?: string }>;
  raw?: unknown;
}

export interface CreateZoneRequest {
  name: string;
  description?: string;
  allowedPaths: string[];
  ttlMinutes: number;
  accessType: AccessType;
  notes?: { slug: string; title: string; content: string; tags: string[] }[];
  createNotebookLM?: boolean;
  notebookTitle?: string;
  notebookShareEmails?: string[];
  notebookSourceMode?: 'minio' | 'url';
}

export interface CreateZoneResponse {
  success: true;
  zoneId: string;
  accessCode: string;
  zoneUrl?: string;
  expiresAt?: number;
  noteCount?: number;
  notebooklm?: NotebookLMMapping | null;
}

export interface ZoneListItem {
  id: string;
  name: string;
  description?: string;
  allowedPaths: string[];
  noteCount: number;
  accessType: AccessType;
  createdAt: number;
  expiresAt: number;
  accessCode?: string;
}
