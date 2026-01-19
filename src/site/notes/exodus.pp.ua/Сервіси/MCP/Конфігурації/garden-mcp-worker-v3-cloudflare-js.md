# Garden MCP Worker v3.0 — Cloudflare Editor Ready (Plain JavaScript)

## 🎯 Призначення

Цей файл містить **чистий ES2022 JavaScript**, готовий для деплою через Cloudflare Dashboard Editor.

**Важливо:** Cloudflare Web Editor НЕ підтримує TypeScript. Цей код — транспільована версія `garden-mcp-worker-v3.md`.

## ✅ Що видалено для сумісності

- `interface` declarations
- `type` annotations (`: string`, `: number`, etc.)
- `as Type` casts  
- Generic types (`<T>`)
- TypeScript-only imports

## 📋 Інструкція для Comet Agent

1. Відкрити Cloudflare Dashboard → Workers & Pages → `garden-mcp-server`
2. Перейти в Code Editor
3. **Повністю замінити** код на версію нижче
4. Натиснути **Save and Deploy**
5. Перевірити `/health` endpoint

---

## Повний код (ES2022 JavaScript)

```javascript
// garden-mcp-worker v3.0 - Cloudflare Editor Compatible
// NO TypeScript - Pure ES2022 JavaScript

import { Hono } from 'hono';
import { cors } from 'hono/cors';

// ============================================
// App Instance
// ============================================
const app = new Hono();

// ============================================
// JWT Utilities
// ============================================
async function generateJWT(payload, secret, ttlMs = 86400000) {
  const now = Date.now();
  const fullPayload = {
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

async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    const [header, body, signature] = parts;
    
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
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
    
    const payload = JSON.parse(
      atob(body.replace(/-/g, '+').replace(/_/g, '/'))
    );
    
    if (payload.exp < Date.now()) return null;
    
    return payload;
  } catch (e) {
    return null;
  }
}

// ============================================
// Auth Middleware
// ============================================
async function authMiddleware(c, next) {
  const authHeader = c.req.header('Authorization');
  const sessionId = c.req.query('session') || c.req.header('X-Session-Id');
  const zoneId = c.req.param('zoneId');
  
  // Try JWT auth first (Owner)
  if (authHeader && authHeader.startsWith('Bearer ')) {
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
      const session = JSON.parse(sessionData);
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
      const zone = JSON.parse(zoneData);
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
function requireOwner(c) {
  const auth = c.get('auth');
  if (!auth || auth.type !== 'owner') {
    return c.json({ success: false, error: 'Unauthorized: Owner access required' }, 401);
  }
  return null;
}

// ============================================
// CORS Middleware
// ============================================
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
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
    features: ['rest-api', 'mcp-jsonrpc', 'sse-transport', 'minio-storage'],
  });
});

// ============================================
// Auth Endpoints (PUBLIC)
// ============================================
app.post('/auth/status', async (c) => {
  const initialized = await c.env.KV.get('owner_initialized');
  return c.json({
    success: true,
    initialized: initialized === 'true',
  });
});

app.post('/auth/setup', async (c) => {
  const { password } = await c.req.json();
  
  const initialized = await c.env.KV.get('owner_initialized');
  if (initialized === 'true') {
    return c.json({ success: false, error: 'Already initialized' }, 400);
  }

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
  const { password } = await c.req.json();
  
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

  const token = await generateJWT({ role: 'owner' }, c.env.JWT_SECRET, 86400000);

  return c.json({ success: true, token });
});

app.post('/auth/refresh', async (c) => {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Token required' }, 401);
  }
  
  const oldToken = authHeader.slice(7);
  const payload = await verifyJWT(oldToken, c.env.JWT_SECRET);
  
  if (!payload) {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
  
  const newToken = await generateJWT({ role: payload.role }, c.env.JWT_SECRET, 86400000);
  
  return c.json({ success: true, token: newToken });
});

app.post('/auth/validate', async (c) => {
  const { token } = await c.req.json();
  
  if (!token) {
    return c.json({ success: true, valid: false });
  }
  
  const payload = await verifyJWT(token, c.env.JWT_SECRET);
  
  return c.json({ 
    success: true, 
    valid: !!payload,
    expiresAt: payload ? payload.exp : null,
  });
});

// ============================================
// Apply Auth Middleware
// ============================================
app.use('*', authMiddleware);

// ============================================
// MinIO Storage (AWS S3-compatible with Signature V4)
// ============================================
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
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

async function hmacSha256Hex(key, message) {
  const sig = await hmacSha256(key, message);
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function uploadToMinIO(env, path, content) {
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

async function deleteFromMinIO(env, path) {
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

async function fetchFromMinIO(env, path) {
  const url = `${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}/${path}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  return await response.json();
}

// ============================================
// Session Management (OWNER PROTECTED)
// ============================================
app.post('/sessions/create', async (c) => {
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const { folders, ttlMinutes, notes, userId, metadata } = await c.req.json();

  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const session = {
    sessionId,
    folders,
    notes,
    expiresAt,
    createdAt: new Date().toISOString(),
    createdBy: 'owner',
  };

  // Store session in KV
  await c.env.KV.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: ttlMinutes * 60 }
  );

  // Upload to MinIO (JSON, JSONL, MD formats)
  const baseUrl = `${c.env.MINIO_ENDPOINT}/${c.env.MINIO_BUCKET}`;
  
  try {
    await uploadToMinIO(c.env, `sessions/${sessionId}/notes.json`, JSON.stringify(notes, null, 2));
    await uploadToMinIO(c.env, `sessions/${sessionId}/notes.jsonl`, notes.map(n => JSON.stringify(n)).join('\n'));
    await uploadToMinIO(c.env, `sessions/${sessionId}/notes.md`, notes.map(n => `# ${n.title}\n\n${n.content}`).join('\n\n---\n\n'));
  } catch (err) {
    console.error('MinIO upload error:', err);
    // Continue - KV is primary storage
  }

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
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const { sessionId } = await c.req.json();
  
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

app.get('/sessions/list', async (c) => {
  const authError = requireOwner(c);
  if (authError) return authError;
  
  return c.json({ 
    success: true, 
    message: 'Use KV list API or maintain session index' 
  });
});

// ============================================
// Access Zones
// ============================================

// PUBLIC: Validate zone
app.get('/zones/validate/:zoneId', async (c) => {
  const zoneId = c.req.param('zoneId');
  const zoneData = await c.env.KV.get(`zone:${zoneId}`);
  
  if (!zoneData) {
    return c.json({ success: false, error: 'Zone not found' }, 404);
  }

  const zone = JSON.parse(zoneData);
  
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

// PUBLIC: Get zone notes
app.get('/zones/:zoneId/notes', async (c) => {
  const zoneId = c.req.param('zoneId');
  const zoneData = await c.env.KV.get(`zone:${zoneId}`);
  
  if (!zoneData) {
    return c.json({ success: false, error: 'Zone not found' }, 404);
  }

  const zone = JSON.parse(zoneData);
  
  if (new Date(zone.expiresAt) < new Date()) {
    return c.json({ success: false, error: 'Zone expired' }, 410);
  }

  return c.json({
    success: true,
    notes: zone.notes,
    expiresAt: zone.expiresAt,
  });
});

// OWNER: Create zone
app.post('/zones/create', async (c) => {
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const { allowedPaths, ttlMinutes, notes } = await c.req.json();

  const zoneId = crypto.randomUUID().slice(0, 8);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  const zone = {
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
  const authError = requireOwner(c);
  if (authError) return authError;
  
  const zoneId = c.req.param('zoneId');
  await c.env.KV.delete(`zone:${zoneId}`);
  
  return c.json({ success: true });
});

// OWNER: List zones
app.get('/zones/list', async (c) => {
  const authError = requireOwner(c);
  if (authError) return authError;
  
  return c.json({ 
    success: true, 
    message: 'Implement zone index for listing' 
  });
});

// ============================================
// MCP JSON-RPC Helpers
// ============================================
function createJSONRPCResponse(id, result) {
  return {
    jsonrpc: '2.0',
    id: id !== null && id !== undefined ? id : 0,
    result,
  };
}

function createJSONRPCError(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id: id !== null && id !== undefined ? id : 0,
    error: { code, message, data },
  };
}

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

async function handleToolCall(params, session, env) {
  const notes = session && session.notes ? session.notes : [];

  switch (params.name) {
    case 'search_notes': {
      const query = (params.arguments.query || '').toLowerCase();
      const filterTags = params.arguments.tags || [];
      const limit = params.arguments.limit || 10;

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
      const slug = params.arguments.slug;
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
      const folder = params.arguments.folder || '';
      const limit = params.arguments.limit || 50;

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
      const tagCounts = {};
      notes.forEach(note => {
        (note.tags || []).forEach(tag => {
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

function getSessionResources(session) {
  return session.notes.map(note => ({
    uri: `note:///${note.slug}`,
    name: note.title,
    mimeType: 'text/markdown',
  }));
}

async function handleResourceRead(params, session, env) {
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

// ============================================
// MCP JSON-RPC Endpoint
// ============================================
app.post('/mcp', async (c) => {
  const sessionId = c.req.query('session');
  
  let session = null;
  if (sessionId) {
    const sessionData = await c.env.KV.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json(createJSONRPCError(null, -32001, 'Session not found'));
    }
    session = JSON.parse(sessionData);
    
    if (new Date(session.expiresAt) < new Date()) {
      return c.json(createJSONRPCError(null, -32002, 'Session expired'));
    }
  }

  const request = await c.req.json();
  
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
        request.params,
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
        request.params,
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
  
  if (sessionId) {
    const sessionData = await c.env.KV.get(`session:${sessionId}`);
    if (!sessionData) {
      return c.json({ error: 'Session not found' }, 404);
    }
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  writer.write(encoder.encode(`event: open\ndata: {"status":"connected","sessionId":"${sessionId || 'anonymous'}"}\n\n`));

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

  const pingInterval = setInterval(() => {
    writer.write(encoder.encode(`:ping\n\n`));
  }, 30000);

  c.executionCtx.waitUntil(
    new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(pingInterval);
        writer.close();
        resolve();
      }, 3600000);
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

export default app;
```

---

## Перевірка після деплою

### Health Check
```bash
curl https://garden-mcp-server.maxfraieho.workers.dev/health
```

Очікувана відповідь:
```json
{
  "status": "ok",
  "version": "3.0",
  "timestamp": "2026-01-13T...",
  "features": ["rest-api", "mcp-jsonrpc", "sse-transport", "minio-storage"]
}
```

### Auth Status
```bash
curl -X POST https://garden-mcp-server.maxfraieho.workers.dev/auth/status
```

### MCP Initialize
```bash
curl -X POST https://garden-mcp-server.maxfraieho.workers.dev/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1}'
```

---

## Comet Agent Instructions

```markdown
# Task: Deploy Garden MCP Worker v3.0 to Cloudflare

## Steps:

1. **Navigate to Cloudflare Dashboard**
   - Open https://dash.cloudflare.com
   - Go to Workers & Pages → garden-mcp-server

2. **Open Code Editor**
   - Click "Edit Code" or "Quick Edit"

3. **Replace Code**
   - Select all existing code (Ctrl+A)
   - Delete it
   - Paste the JavaScript code from section "Повний код (ES2022 JavaScript)"

4. **Save and Deploy**
   - Click "Save and Deploy" button
   - Wait for deployment to complete

5. **Verify**
   - Open https://garden-mcp-server.maxfraieho.workers.dev/health
   - Confirm response contains "status": "ok"

6. **Check Logs** (if issues)
   - Go to Workers → garden-mcp-server → Logs
   - Look for any errors

## Success Criteria:
- /health returns 200 OK with status: "ok"
- No syntax errors in console
- Worker shows "Active" status
```
