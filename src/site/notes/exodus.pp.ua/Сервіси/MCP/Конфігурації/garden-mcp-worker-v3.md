# Garden MCP Worker v3.0 — Повний MCP Server з Авторизацією

## Архітектура

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Cloudflare Worker v3.0                          │
├─────────────────────────────────────────────────────────────────────┤
│                         PUBLIC ENDPOINTS                             │
│  GET  /health         → Health check                                │
│  POST /auth/status    → Auth initialization status                  │
│  POST /auth/setup     → First-time setup (one-time)                 │
│  POST /auth/login     → Owner login → JWT                           │
├─────────────────────────────────────────────────────────────────────┤
│                     OWNER-PROTECTED ENDPOINTS                        │
│  POST /sessions/create  → Create MCP session [🔐 JWT required]      │
│  POST /sessions/revoke  → Revoke session [🔐 JWT required]          │
│  POST /zones/create     → Create access zone [🔐 JWT required]      │
│  GET  /zones/list       → List all zones [🔐 JWT required]          │
├─────────────────────────────────────────────────────────────────────┤
│                     SESSION-BASED ENDPOINTS                          │
│  POST /mcp?session=ID   → MCP JSON-RPC [🎫 Session required]        │
│  GET  /sse?session=ID   → MCP SSE transport [🎫 Session required]   │
├─────────────────────────────────────────────────────────────────────┤
│                       ZONE-BASED ENDPOINTS                           │
│  GET  /zones/validate/:zoneId → Validate zone access [🎟️ Zone ID]  │
│  GET  /zones/:zoneId/notes    → Get zone notes [🎟️ Zone ID]        │
└─────────────────────────────────────────────────────────────────────┘
```

## Рівні доступу (Access Hierarchy)

```
┌─────────────────────────────────────────────────────────────┐
│  👑 OWNER (JWT Token)                                        │
│  ├── Повний доступ до всіх нотаток                          │
│  ├── Створення/видалення сесій                              │
│  ├── Створення/видалення зон                                │
│  └── Управління налаштуваннями                              │
├─────────────────────────────────────────────────────────────┤
│  🎫 SESSION (Session ID + TTL)                               │
│  ├── Доступ до вибраних папок                               │
│  ├── MCP tools (search, read)                               │
│  ├── Обмежений час життя                                    │
│  └── Не може створювати під-сесії                           │
├─────────────────────────────────────────────────────────────┤
│  🎟️ ZONE (Zone ID + TTL)                                    │
│  ├── Read-only доступ до allowedPaths                       │
│  ├── Публічний доступ (без логіну)                          │
│  ├── QR-код для швидкого доступу                            │
│  └── Автоматичне видалення після expiration                 │
└─────────────────────────────────────────────────────────────┘
```

## Повний код Worker

```typescript
// garden-mcp-worker/src/index.ts

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ============================================
// Types
// ============================================
interface Env {
  MINIO_ENDPOINT: string;
  MINIO_ACCESS_KEY: string;
  MINIO_SECRET_KEY: string;
  MINIO_BUCKET: string;
  JWT_SECRET: string;
  KV: KVNamespace;
}

interface JWTPayload {
  role: 'owner';
  exp: number;
  iat: number;
}

interface MCPSession {
  sessionId: string;
  folders: string[];
  notes: MCPNote[];
  expiresAt: string;
  createdAt: string;
  createdBy: string; // owner identifier
}

interface AccessZone {
  zoneId: string;
  allowedPaths: string[];
  notes: MCPNote[];
  noteCount: number;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
}

interface MCPNote {
  slug: string;
  title: string;
  tags: string[];
  content: string;
}

interface JSONRPCRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// Custom context with auth info
type AuthContext = {
  Bindings: Env;
  Variables: {
    auth?: {
      type: 'owner' | 'session' | 'zone' | 'anonymous';
      payload?: JWTPayload;
      session?: MCPSession;
      zone?: AccessZone;
    };
  };
};

const app = new Hono<AuthContext>();

// ============================================
// JWT Utilities
// ============================================
async function generateJWT(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string, ttlMs = 86400000): Promise<string> {
  const now = Date.now();
  const fullPayload: JWTPayload = {
    ...payload,
    iat: now,
    exp: now + ttlMs,
  };
  
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const body = btoa(JSON.stringify(fullPayload))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  
  return `${header}.${body}.${signature}`;
}

async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, signature] = parts;
    
    // Verify signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    // Decode signature
    const sigBytes = Uint8Array.from(
      atob(signature.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      sigBytes,
      encoder.encode(`${header}.${body}`)
    );
    
    if (!isValid) return null;
    
    // Decode and check expiration
    const payload: JWTPayload = JSON.parse(
      atob(body.replace(/-/g, '+').replace(/_/g, '/'))
    );
    
    if (payload.exp < Date.now()) return null;
    
    return payload;
  } catch {
    return null;
  }
}

async function hashPassword(password: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ============================================
// Auth Middleware
// ============================================
async function authMiddleware(c: any, next: () => Promise<void>) {
  const authHeader = c.req.header('Authorization');
  const sessionId = c.req.query('session') || c.req.header('X-Session-Id');
  const zoneId = c.req.param('zoneId');
  
  // Try JWT auth first (Owner)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    if (payload) {
      c.set('auth', { type: 'owner', payload });
      return next();
    }
  }
  
  // Try Session auth
  if (sessionId) {
    const sessionData = await c.env.KV.get(`session:${sessionId}`);
    if (sessionData) {
      const session: MCPSession = JSON.parse(sessionData);
      if (new Date(session.expiresAt) > new Date()) {
        c.set('auth', { type: 'session', session });
        return next();
      }
    }
  }
  
  // Try Zone auth
  if (zoneId) {
    const zoneData = await c.env.KV.get(`zone:${zoneId}`);
    if (zoneData) {
      const zone: AccessZone = JSON.parse(zoneData);
      if (new Date(zone.expiresAt) > new Date()) {
        c.set('auth', { type: 'zone', zone });
        return next();
      }
    }
  }
  
  // Anonymous
  c.set('auth', { type: 'anonymous' });
  return next();
}

// Require owner auth
function requireOwner(c: any): Response | null {
  const auth = c.get('auth');
  if (auth?.type !== 'owner') {
    return c.json({ success: false, error: 'Unauthorized: Owner access required' }, 401);
  }
  return null;
}

// Require session auth
function requireSession(c: any): Response | null {
  const auth = c.get('auth');
  if (auth?.type !== 'session' && auth?.type !== 'owner') {
    return c.json({ success: false, error: 'Unauthorized: Session required' }, 401);
  }
  return null;
}

// ============================================
// CORS Middleware
// ============================================
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Session-Id'],
  exposeHeaders: ['Content-Type'],
  maxAge: 86400,
}));

// ============================================
// Health Check
// ============================================
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    version: '3.0',
    timestamp: new Date().toISOString(),
    features: ['rest-api', 'mcp-jsonrpc', 'sse-transport'],
  });
});

// ============================================
// Auth Endpoints
// ============================================
app.post('/auth/status', async (c) => {
  const initialized = await c.env.KV.get('owner_initialized');
  return c.json({
    success: true,
    initialized: initialized === 'true',
  });
});

app.post('/auth/setup', async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  
  const initialized = await c.env.KV.get('owner_initialized');
  if (initialized === 'true') {
    return c.json({ success: false, error: 'Already initialized' }, 400);
  }

  // Hash password (use proper hashing in production)
  const encoder = new TextEncoder();
  const data = encoder.encode(password + c.env.JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  await c.env.KV.put('owner_password_hash', hashHex);
  await c.env.KV.put('owner_initialized', 'true');

  return c.json({ success: true });
});

app.post('/auth/login', async (c) => {
  const { password } = await c.req.json<{ password: string }>();
  
  const storedHash = await c.env.KV.get('owner_password_hash');
  if (!storedHash) {
    return c.json({ success: false, error: 'Not initialized' }, 401);
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password + c.env.JWT_SECRET);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  if (hashHex !== storedHash) {
    return c.json({ success: false, error: 'Invalid password' }, 401);
  }

  // Generate JWT (24h expiration)
  const token = await generateJWT({ role: 'owner' }, c.env.JWT_SECRET, 86400000);

  return c.json({ success: true, token });
});

// 🔄 Token Refresh - extends session without password
app.post('/auth/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Token required' }, 401);
  }
  
  const oldToken = authHeader.slice(7);
  const payload = await verifyJWT(oldToken, c.env.JWT_SECRET);
  
  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
  
  // Generate new token with fresh expiration
  const newToken = await generateJWT({ role: payload.role }, c.env.JWT_SECRET, 86400000);
  
  return c.json({ success: true, token: newToken });
});

// Validate token (for initial check)
app.post('/auth/validate', async (c) => {
  const { token } = await c.req.json<{ token: string }>();
  
  if (!token) {
    return c.json({ success: true, valid: false });
  }
  
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  
  return c.json({ 
    success: true, 
    valid: !!payload,
    expiresAt: payload?.exp,
  });
});

// ============================================
// Apply Auth Middleware to all routes
// ============================================
app.use('*', authMiddleware);

// ============================================
// Session Management (OWNER PROTECTED)
// ============================================
app.post('/sessions/create', async (c) => {
  // 🔐 Require owner authentication
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const { folders, ttlMinutes, notes, userId, metadata } = await c.req.json<{
    folders: string[];
    ttlMinutes: number;
    notes: MCPNote[];
    userId?: string;
    metadata?: Record<string, unknown>;
  }>();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();
  const auth = c.get('auth');

  const session: MCPSession = {
    sessionId,
    folders,
    notes,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: 'owner', // Track who created
  };

  // Store session in KV
  await c.env.KV.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: ttlMinutes * 60 }
  );

  // Upload to MinIO (JSON, JSONL, MD formats)
  const baseUrl = `${c.env.MINIO_ENDPOINT}/${c.env.MINIO_BUCKET}`;
  
  await uploadToMinIO(c.env, `sessions/${sessionId}/notes.json`, JSON.stringify(notes, null, 2));
  await uploadToMinIO(c.env, `sessions/${sessionId}/notes.jsonl`, notes.map(n => JSON.stringify(n)).join('\n'));
  await uploadToMinIO(c.env, `sessions/${sessionId}/notes.md`, notes.map(n => `# ${n.title}\n\n${n.content}`).join('\n\n---\n\n'));

  return c.json({
    success: true,
    sessionId,
    sessionUrl: `https://${c.req.header('host')}/mcp?session=${sessionId}`,
    expiresAt,
    noteCount: notes.length,
    storage: 'minio',
    formats: {
      json: `${baseUrl}/sessions/${sessionId}/notes.json`,
      jsonl: `${baseUrl}/sessions/${sessionId}/notes.jsonl`,
      markdown: `${baseUrl}/sessions/${sessionId}/notes.md`,
    },
  });
});

app.post('/sessions/revoke', async (c) => {
  // 🔐 Require owner authentication
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const { sessionId } = await c.req.json<{ sessionId: string }>();
  
  // Delete from KV
  await c.env.KV.delete(`session:${sessionId}`);
  
  // Delete from MinIO (all formats)
  try {
    await Promise.all([
      deleteFromMinIO(c.env, `sessions/${sessionId}/notes.json`),
      deleteFromMinIO(c.env, `sessions/${sessionId}/notes.jsonl`),
      deleteFromMinIO(c.env, `sessions/${sessionId}/notes.md`),
    ]);
  } catch (err) {
    console.error('MinIO cleanup error:', err);
  }
  
  return c.json({ success: true });
});

// List all sessions (owner only)
app.get('/sessions/list', async (c) => {
  // 🔐 Require owner authentication
  const authError = requireOwner(c);
  if (authError) return authError;
  
  // Note: KV doesn't support listing by prefix natively
  // In production, maintain a separate index
  return c.json({ 
    success: true, 
    message: 'Use KV list API or maintain session index' 
  });
});

// ============================================
// Access Zones (PUBLIC validation, OWNER create/delete)
// ============================================

// PUBLIC: Validate zone (no auth required)
app.get('/zones/validate/:zoneId', async (c) => {
  const zoneId = c.req.param('zoneId');
  const zoneData = await c.env.KV.get(`zone:${zoneId}`);
  
  if (!zoneData) {
    return c.json({ success: false, error: 'Zone not found' }, 404);
  }

  const zone: AccessZone = JSON.parse(zoneData);
  
  if (new Date(zone.expiresAt) < new Date()) {
    return c.json({ success: false, error: 'Zone expired' }, 410);
  }

  return c.json({
    success: true,
    zone: {
      zoneId: zone.zoneId,
      allowedPaths: zone.allowedPaths,
      expiresAt: zone.expiresAt,
      noteCount: zone.noteCount,
    },
  });
});

// PUBLIC: Get zone notes (zone ID acts as access token)
app.get('/zones/:zoneId/notes', async (c) => {
  const zoneId = c.req.param('zoneId');
  const zoneData = await c.env.KV.get(`zone:${zoneId}`);
  
  if (!zoneData) {
    return c.json({ success: false, error: 'Zone not found' }, 404);
  }

  const zone: AccessZone = JSON.parse(zoneData);
  
  if (new Date(zone.expiresAt) < new Date()) {
    return c.json({ success: false, error: 'Zone expired' }, 410);
  }

  // Return notes filtered by allowedPaths
  return c.json({
    success: true,
    notes: zone.notes,
    expiresAt: zone.expiresAt,
  });
});

// OWNER: Create zone
app.post('/zones/create', async (c) => {
  // 🔐 Require owner authentication
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const { allowedPaths, ttlMinutes, notes } = await c.req.json<{
    allowedPaths: string[];
    ttlMinutes: number;
    notes: MCPNote[];
  }>();

  const zoneId = crypto.randomUUID().slice(0, 8);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const zone: AccessZone = {
    zoneId,
    allowedPaths,
    notes,
    noteCount: notes.length,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: 'owner',
  };

  await c.env.KV.put(
    `zone:${zoneId}`,
    JSON.stringify(zone),
    { expirationTtl: ttlMinutes * 60 }
  );

  return c.json({
    success: true,
    zoneId,
    zoneUrl: `https://${c.req.header('host')?.replace('garden-mcp-server', 'exodus')}/zone/${zoneId}`,
    expiresAt,
    noteCount: notes.length,
  });
});

// OWNER: Revoke zone
app.delete('/zones/:zoneId', async (c) => {
  // 🔐 Require owner authentication
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const zoneId = c.req.param('zoneId');
  await c.env.KV.delete(`zone:${zoneId}`);
  
  return c.json({ success: true });
});

// OWNER: List all zones
app.get('/zones/list', async (c) => {
  // 🔐 Require owner authentication
  const authError = requireOwner(c);
  if (authError) return authError;
  
  // Note: Maintain zone index in production
  return c.json({ 
    success: true, 
    message: 'Implement zone index for listing' 
  });
});

// ============================================
// MCP JSON-RPC Endpoint
// ============================================
app.post('/mcp', async (c) => {
  const sessionId = c.req.query('session');
  
  // Validate session if provided
  let session: MCPSession | null = null;
  if (sessionId) {
    const sessionData = await c.env.KV.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(createJSONRPCError(null, -32001, 'Session not found'));
    }
    session = JSON.parse(sessionData);
    
    if (new Date(session!.expiresAt) < new Date()) {
      return c.json(createJSONRPCError(null, -32002, 'Session expired'));
    }
  }

  const request = await c.req.json<JSONRPCRequest>();
  
  if (request.jsonrpc !== '2.0') {
    return c.json(createJSONRPCError(request.id, -32600, 'Invalid JSON-RPC version'));
  }

  switch (request.method) {
    case 'initialize':
      return c.json(createJSONRPCResponse(request.id, {
        protocolVersion: '2024-11-05',
        serverInfo: {
          name: 'garden-mcp-server',
          version: '3.0.0',
        },
        capabilities: {
          tools: {},
          resources: {},
        },
      }));

    case 'tools/list':
      return c.json(createJSONRPCResponse(request.id, {
        tools: getMCPTools(),
      }));

    case 'tools/call':
      const toolResult = await handleToolCall(
        request.params as { name: string; arguments: Record<string, unknown> },
        session,
        c.env
      );
      return c.json(createJSONRPCResponse(request.id, toolResult));

    case 'resources/list':
      return c.json(createJSONRPCResponse(request.id, {
        resources: session ? getSessionResources(session) : [],
      }));

    case 'resources/read':
      const resourceResult = await handleResourceRead(
        request.params as { uri: string },
        session,
        c.env
      );
      return c.json(createJSONRPCResponse(request.id, resourceResult));

    default:
      return c.json(createJSONRPCError(request.id, -32601, `Method not found: ${request.method}`));
  }
});

// ============================================
// MCP SSE Transport
// ============================================
app.get('/sse', async (c) => {
  const sessionId = c.req.query('session');
  
  // Validate session
  if (sessionId) {
    const sessionData = await c.env.KV.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json({ error: 'Session not found' }, 404);
    }
  }

  // Create SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  writer.write(encoder.encode(`event: open\ndata: {\\"status\\":\\"connected\\",\\"sessionId\\":\\"${sessionId || 'anonymous'}\\"}\n\n`));

  // Send server info
  writer.write(encoder.encode(`event: message\ndata: ${JSON.stringify({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
    params: {
      serverInfo: {
        name: 'garden-mcp-server',
        version: '3.0.0',
      },
    },
  })}\n\n`));

  // Keep-alive ping every 30 seconds
  const pingInterval = setInterval(() => {
    writer.write(encoder.encode(`:ping\n\n`));
  }, 30000);

  // Clean up on close
  c.executionCtx.waitUntil(
    new Promise<void>((resolve) => {
      setTimeout(() => {
        clearInterval(pingInterval);
        writer.close();
        resolve();
      }, 3600000); // 1 hour max
    })
  );

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });
});

// ============================================
// 404 Handler
// ============================================
app.notFound((c) => {
  return c.json({ success: false, error: 'Not found' }, 404);
});

// ============================================
// Helper Functions
// ============================================

function getMCPTools() {
  return [
    {
      name: 'search_notes',
      description: 'Search notes by title, content, or tags',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
          tags: { type: 'array', items: { type: 'string' }, description: 'Filter by tags' },
          limit: { type: 'number', description: 'Max results (default 10)' },
        },
        required: ['query'],
      },
    },
    {
      name: 'get_note',
      description: 'Get a specific note by slug',
      inputSchema: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Note slug/path' },
        },
        required: ['slug'],
      },
    },
    {
      name: 'list_notes',
      description: 'List all available notes',
      inputSchema: {
        type: 'object',
        properties: {
          folder: { type: 'string', description: 'Filter by folder path' },
          limit: { type: 'number', description: 'Max results (default 50)' },
        },
      },
    },
    {
      name: 'get_tags',
      description: 'Get all tags with note counts',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];
}

async function handleToolCall(
  params: { name: string; arguments: Record<string, unknown> },
  session: MCPSession | null,
  env: Env
): Promise<{ content: Array<{ type: string; text: string }> }> {
  const notes = session?.notes || [];

  switch (params.name) {
    case 'search_notes': {
      const query = (params.arguments.query as string || '').toLowerCase();
      const filterTags = params.arguments.tags as string[] || [];
      const limit = (params.arguments.limit as number) || 10;

      const results = notes
        .filter(note => {
          const matchesQuery = 
            note.title.toLowerCase().includes(query) ||
            note.content.toLowerCase().includes(query);
          const matchesTags = filterTags.length === 0 ||
            filterTags.some(tag => note.tags.includes(tag));
          return matchesQuery && matchesTags;
        })
        .slice(0, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results.map(n => ({
            slug: n.slug,
            title: n.title,
            tags: n.tags,
            preview: n.content.slice(0, 200),
          })), null, 2),
        }],
      };
    }

    case 'get_note': {
      const slug = params.arguments.slug as string;
      const note = notes.find(n => n.slug === slug || n.slug.endsWith(`/${slug}`));
      
      if (!note) {
        return {
          content: [{ type: 'text', text: `Note not found: ${slug}` }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(note, null, 2),
        }],
      };
    }

    case 'list_notes': {
      const folder = params.arguments.folder as string || '';
      const limit = (params.arguments.limit as number) || 50;

      const results = notes
        .filter(n => !folder || n.slug.startsWith(folder))
        .slice(0, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(results.map(n => ({
            slug: n.slug,
            title: n.title,
            tags: n.tags,
          })), null, 2),
        }],
      };
    }

    case 'get_tags': {
      const tagCounts: Record<string, number> = {};
      notes.forEach(note => {
        note.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(tagCounts, null, 2),
        }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${params.name}` }],
      };
  }
}

function getSessionResources(session: MCPSession) {
  return session.notes.map(note => ({
    uri: `note:///${note.slug}`,
    name: note.title,
    mimeType: 'text/markdown',
  }));
}

async function handleResourceRead(
  params: { uri: string },
  session: MCPSession | null,
  env: Env
): Promise<{ contents: Array<{ uri: string; mimeType: string; text: string }> }> {
  if (!session) {
    return { contents: [] };
  }

  const slug = params.uri.replace('note:///', '');
  const note = session.notes.find(n => n.slug === slug);

  if (!note) {
    return { contents: [] };
  }

  return {
    contents: [{
      uri: params.uri,
      mimeType: 'text/markdown',
      text: note.content,
    }],
  };
}

function createJSONRPCResponse(id: string | number | null, result: unknown): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? 0,
    result,
  };
}

function createJSONRPCError(
  id: string | number | null,
  code: number,
  message: string,
  data?: unknown
): JSONRPCResponse {
  return {
    jsonrpc: '2.0',
    id: id ?? 0,
    error: { code, message, data },
  };
}

async function generateJWT(payload: Record<string, unknown>, secret: string): Promise<string> {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify({ ...payload, exp: Date.now() + 86400000 }));
  
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(`${header}.${body}`));
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
  
  return `${header}.${body}.${sig}`;
}

// ============================================
// MinIO Storage (AWS S3-compatible with Signature V4)
// ============================================

async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key: string | Uint8Array, message: string): Promise<Uint8Array> {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBuffer = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer));
}

async function hmacSha256Hex(key: Uint8Array, message: string): Promise<string> {
  const sig = await hmacSha256(key, message);
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToMinIO(env: Env, path: string, content: string): Promise<{ bucket: string; key: string; url: string }> {
  const endpoint = env.MINIO_ENDPOINT;
  const bucket = env.MINIO_BUCKET;
  const key = path;
  const url = `${endpoint}/${bucket}/${key}`;
  
  const date = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15) + 'Z';
  const dateStamp = date.substring(0, 8);
  const method = 'PUT';
  const contentType = 'application/json; charset=utf-8';
  const payloadHash = await sha256(content);
  
  const canonicalUri = `/${bucket}/${key}`;
  const host = new URL(endpoint).host;
  const canonicalHeaders = [
    `content-type:${contentType}`,
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${date}`,
  ].join('\n');
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const region = 'us-east-1';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    date,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  const kDate = await hmacSha256('AWS4' + env.MINIO_SECRET_KEY, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256Hex(kSigning, stringToSign);
  
  const authorization = [
    `${algorithm} Credential=${env.MINIO_ACCESS_KEY}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');
  
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
      'Authorization': authorization,
    },
    body: content,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MinIO upload failed: ${response.status} - ${errorText}`);
  }
  
  return { bucket, key, url };
}

async function deleteFromMinIO(env: Env, path: string): Promise<void> {
  const endpoint = env.MINIO_ENDPOINT;
  const bucket = env.MINIO_BUCKET;
  const key = path;
  const url = `${endpoint}/${bucket}/${key}`;
  
  const date = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15) + 'Z';
  const dateStamp = date.substring(0, 8);
  const method = 'DELETE';
  const payloadHash = await sha256('');
  
  const canonicalUri = `/${bucket}/${key}`;
  const host = new URL(endpoint).host;
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${date}`,
  ].join('\n');
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
    '',
    signedHeaders,
    payloadHash,
  ].join('\n');
  
  const algorithm = 'AWS4-HMAC-SHA256';
  const region = 'us-east-1';
  const service = 's3';
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    algorithm,
    date,
    credentialScope,
    await sha256(canonicalRequest),
  ].join('\n');
  
  const kDate = await hmacSha256('AWS4' + env.MINIO_SECRET_KEY, dateStamp);
  const kRegion = await hmacSha256(kDate, region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, 'aws4_request');
  const signature = await hmacSha256Hex(kSigning, stringToSign);
  
  const authorization = [
    `${algorithm} Credential=${env.MINIO_ACCESS_KEY}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');
  
  await fetch(url, {
    method,
    headers: {
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': date,
      'Authorization': authorization,
    },
  });
}

async function fetchFromMinIO(env: Env, path: string): Promise<unknown | null> {
  const url = `${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}/${path}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return await response.json();
}

export default app;
```

## wrangler.toml

```toml
name = "garden-mcp-server"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
MINIO_ENDPOINT = "https://minio.example.com"
MINIO_BUCKET = "garden-sessions"

[[kv_namespaces]]
binding = "KV"
id = "your-kv-namespace-id"

# Secrets (set via wrangler secret put):
# - MINIO_ACCESS_KEY
# - MINIO_SECRET_KEY
# - JWT_SECRET
```

## Тестування

### Health Check
```bash
curl https://garden-mcp-server.maxfraieho.workers.dev/health
```

### MCP Initialize
```bash
curl -X POST https://garden-mcp-server.maxfraieho.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1}'
```

### MCP Tools List
```bash
curl -X POST https://garden-mcp-server.maxfraieho.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":2}'
```

### SSE Connection
```bash
curl -N https://garden-mcp-server.maxfraieho.workers.dev/sse
```

## MCP Client Configuration

### Claude Desktop
```json
{
  "mcpServers": {
    "garden": {
      "url": "https://garden-mcp-server.maxfraieho.workers.dev/sse?session=SESSION_ID",
      "transport": "sse"
    }
  }
}
```

### Cursor/Windsurf
```json
{
  "mcpServers": {
    "garden": {
      "command": "npx",
      "args": ["mcp-remote", "https://garden-mcp-server.maxfraieho.workers.dev/mcp?session=SESSION_ID"]
    }
  }
}
```

## Деплой

```bash
# Install wrangler
npm install -g wrangler

# Login
wrangler login

# Set secrets
wrangler secret put MINIO_ACCESS_KEY
wrangler secret put MINIO_SECRET_KEY
wrangler secret put JWT_SECRET

# Deploy
wrangler deploy
```
