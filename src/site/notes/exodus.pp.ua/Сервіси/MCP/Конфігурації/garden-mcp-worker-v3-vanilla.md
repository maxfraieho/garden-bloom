// ============================================
// Garden MCP Worker v3.0 - Vanilla Cloudflare Workers
// NO EXTERNAL DEPENDENCIES - Pure ES2022 JavaScript
// ============================================

// ============================================
// Helper Functions
// ============================================

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
      ...extraHeaders
    }
  });
}

function corsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Session-Id',
      'Access-Control-Max-Age': '86400'
    }
  });
}

function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

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

async function hashPassword(password, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

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

async function uploadToMinIO(env, path, content, contentType = 'application/json; charset=utf-8') {
  const endpoint = env.MINIO_ENDPOINT;
  const bucket = env.MINIO_BUCKET;
  const key = path;
  const url = `${endpoint}/${bucket}/${key}`;
  
  const date = new Date().toISOString().replace(/[-:]/g, '').substring(0, 15) + 'Z';
  const dateStamp = date.substring(0, 8);
  const method = 'PUT';
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
// Route Handlers
// ============================================

async function handleHealth() {
  return jsonResponse({
    status: 'ok',
    version: '3.0',
    timestamp: new Date().toISOString(),
    features: ['rest-api', 'mcp-jsonrpc', 'sse-transport', 'minio-storage'],
    runtime: 'vanilla-cloudflare-workers'
  });
}

async function handleAuthStatus(env) {
  const initialized = await env.KV.get('owner_initialized');
  return jsonResponse({
    success: true,
    initialized: initialized === 'true',
  });
}

async function handleAuthSetup(request, env) {
  const body = await request.json();
  const password = body.password;
  
  const initialized = await env.KV.get('owner_initialized');
  if (initialized === 'true') {
    return errorResponse('Already initialized', 400);
  }

  const hashHex = await hashPassword(password, env.JWT_SECRET);

  await env.KV.put('owner_password_hash', hashHex);
  await env.KV.put('owner_initialized', 'true');

  return jsonResponse({ success: true });
}

async function handleAuthLogin(request, env) {
  const body = await request.json();
  const password = body.password;
  
  const storedHash = await env.KV.get('owner_password_hash');
  if (!storedHash) {
    return errorResponse('Not initialized', 401);
  }

  const hashHex = await hashPassword(password, env.JWT_SECRET);

  if (hashHex !== storedHash) {
    return errorResponse('Invalid password', 401);
  }

  const token = await generateJWT({ role: 'owner' }, env.JWT_SECRET, 86400000);

  return jsonResponse({ success: true, token });
}

async function handleAuthRefresh(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return errorResponse('Token required', 401);
  }
  
  const oldToken = authHeader.slice(7);
  const payload = await verifyJWT(oldToken, env.JWT_SECRET);
  
  if (!payload) {
    return errorResponse('Invalid or expired token', 401);
  }
  
  const newToken = await generateJWT({ role: payload.role }, env.JWT_SECRET, 86400000);
  
  return jsonResponse({ success: true, token: newToken });
}

async function handleAuthValidate(request, env) {
  const body = await request.json();
  const token = body.token;
  
  if (!token) {
    return jsonResponse({ success: true, valid: false });
  }
  
  const payload = await verifyJWT(token, env.JWT_SECRET);
  
  return jsonResponse({ 
    success: true, 
    valid: !!payload,
    expiresAt: payload ? payload.exp : null,
  });
}

async function handleSessionsCreate(request, env, host) {
  const body = await request.json();
  const { folders, ttlMinutes, notes } = body;

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
  await env.KV.put(
    `session:${sessionId}`,
    JSON.stringify(session),
    { expirationTtl: ttlMinutes * 60 }
  );

  // Upload to MinIO (JSON, JSONL, MD formats)
  const baseUrl = `${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}`;
  
  try {
    await uploadToMinIO(env, `sessions/${sessionId}/notes.json`, JSON.stringify(notes, null, 2));
    await uploadToMinIO(env, `sessions/${sessionId}/notes.jsonl`, notes.map(n => JSON.stringify(n)).join('\n'), 'application/x-ndjson');
    await uploadToMinIO(env, `sessions/${sessionId}/notes.md`, notes.map(n => `# ${n.title}\n\n${n.content}`).join('\n\n---\n\n'), 'text/markdown');
  } catch (err) {
    console.error('MinIO upload error:', err);
    // Continue - KV is primary storage
  }

  return jsonResponse({
    success: true,
    sessionId,
    sessionUrl: `https://${host}/mcp?session=${sessionId}`,
    expiresAt,
    noteCount: notes.length,
    storage: 'minio',
    formats: {
      json: `${baseUrl}/sessions/${sessionId}/notes.json`,
      jsonl: `${baseUrl}/sessions/${sessionId}/notes.jsonl`,
      markdown: `${baseUrl}/sessions/${sessionId}/notes.md`,
    },
  });
}

async function handleSessionsRevoke(request, env) {
  const body = await request.json();
  const sessionId = body.sessionId;
  
  // Delete from KV
  await env.KV.delete(`session:${sessionId}`);
  
  // Delete from MinIO (all formats)
  try {
    await Promise.all([
      deleteFromMinIO(env, `sessions/${sessionId}/notes.json`),
      deleteFromMinIO(env, `sessions/${sessionId}/notes.jsonl`),
      deleteFromMinIO(env, `sessions/${sessionId}/notes.md`),
    ]);
  } catch (err) {
    console.error('MinIO cleanup error:', err);
  }
  
  return jsonResponse({ success: true });
}

async function handleSessionsList(env) {
  return jsonResponse({ 
    success: true, 
    message: 'Use KV list API or maintain session index' 
  });
}

async function handleZonesValidate(zoneId, env) {
  const zoneData = await env.KV.get(`zone:${zoneId}`);
  
  if (!zoneData) {
    return errorResponse('Zone not found', 404);
  }

  const zone = JSON.parse(zoneData);
  
  if (new Date(zone.expiresAt) < new Date()) {
    return errorResponse('Zone expired', 410);
  }

  return jsonResponse({
    success: true,
    zone: {
      zoneId: zone.zoneId,
      allowedPaths: zone.allowedPaths,
      expiresAt: zone.expiresAt,
      noteCount: zone.noteCount,
    },
  });
}

async function handleZonesNotes(zoneId, env) {
  const zoneData = await env.KV.get(`zone:${zoneId}`);
  
  if (!zoneData) {
    return errorResponse('Zone not found', 404);
  }

  const zone = JSON.parse(zoneData);
  
  if (new Date(zone.expiresAt) < new Date()) {
    return errorResponse('Zone expired', 410);
  }

  return jsonResponse({
    success: true,
    notes: zone.notes,
    expiresAt: zone.expiresAt,
  });
}

async function handleZonesCreate(request, env, host) {
  const body = await request.json();
  const { allowedPaths, ttlMinutes, notes } = body;

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

  await env.KV.put(
    `zone:${zoneId}`,
    JSON.stringify(zone),
    { expirationTtl: ttlMinutes * 60 }
  );

  return jsonResponse({
    success: true,
    zoneId,
    zoneUrl: `https://${host.replace('garden-mcp-server', 'exodus')}/zone/${zoneId}`,
    expiresAt,
    noteCount: notes.length,
  });
}

async function handleZonesDelete(zoneId, env) {
  await env.KV.delete(`zone:${zoneId}`);
  return jsonResponse({ success: true });
}

async function handleZonesList(env) {
  return jsonResponse({ 
    success: true, 
    message: 'Implement zone index for listing' 
  });
}

async function handleMCP(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  
  let session = null;
  if (sessionId) {
    const sessionData = await env.KV.get(`session:${sessionId}`);
    if (!sessionData) {
      return jsonResponse(createJSONRPCError(null, -32001, 'Session not found'));
    }
    session = JSON.parse(sessionData);
    
    if (new Date(session.expiresAt) < new Date()) {
      return jsonResponse(createJSONRPCError(null, -32002, 'Session expired'));
    }
  }

  const rpcRequest = await request.json();
  
  if (rpcRequest.jsonrpc !== '2.0') {
    return jsonResponse(createJSONRPCError(rpcRequest.id, -32600, 'Invalid JSON-RPC version'));
  }

  switch (rpcRequest.method) {
    case 'initialize':
      return jsonResponse(createJSONRPCResponse(rpcRequest.id, {
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
      return jsonResponse(createJSONRPCResponse(rpcRequest.id, {
        tools: getMCPTools(),
      }));

    case 'tools/call':
      const toolResult = await handleToolCall(
        rpcRequest.params,
        session,
        env
      );
      return jsonResponse(createJSONRPCResponse(rpcRequest.id, toolResult));

    case 'resources/list':
      return jsonResponse(createJSONRPCResponse(rpcRequest.id, {
        resources: session ? getSessionResources(session) : [],
      }));

    case 'resources/read':
      const resourceResult = await handleResourceRead(
        rpcRequest.params,
        session,
        env
      );
      return jsonResponse(createJSONRPCResponse(rpcRequest.id, resourceResult));

    default:
      return jsonResponse(createJSONRPCError(rpcRequest.id, -32601, `Method not found: ${rpcRequest.method}`));
  }
}

async function handleSSE(request, env, ctx) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');
  
  if (sessionId) {
    const sessionData = await env.KV.get(`session:${sessionId}`);
    if (!sessionData) {
      return errorResponse('Session not found', 404);
    }
  }

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  // Send initial connection message
  await writer.write(encoder.encode(`event: open\ndata: {\"status\":\"connected\",\"sessionId\":\"${sessionId || 'anonymous'}\"}\n\n`));

  // Send server info
  await writer.write(encoder.encode(`event: message\ndata: ${JSON.stringify({
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
    writer.write(encoder.encode(`:ping\n\n`)).catch(() => {});
  }, 30000);

  // Clean up on close
  ctx.waitUntil(
    new Promise((resolve) => {
      setTimeout(() => {
        clearInterval(pingInterval);
        writer.close().catch(() => {});
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
}

// ============================================
// Auth Middleware Helper
// ============================================

async function verifyOwnerAuth(request, env) {
  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  
  const token = authHeader.slice(7);
  const payload = await verifyJWT(token, env.JWT_SECRET);
  
  if (!payload || payload.role !== 'owner') {
    return null;
  }
  
  return payload;
}

// ============================================
// Main Router
// ============================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const host = request.headers.get('host') || 'localhost';

    // Handle CORS preflight
    if (method === 'OPTIONS') {
      return corsResponse();
    }

    try {
      // ============================================
      // PUBLIC ENDPOINTS
      // ============================================
      
      // GET /health
      if (method === 'GET' && path === '/health') {
        return await handleHealth();
      }

      // POST /auth/status
      if (method === 'POST' && path === '/auth/status') {
        return await handleAuthStatus(env);
      }

      // POST /auth/setup
      if (method === 'POST' && path === '/auth/setup') {
        return await handleAuthSetup(request, env);
      }

      // POST /auth/login
      if (method === 'POST' && path === '/auth/login') {
        return await handleAuthLogin(request, env);
      }

      // POST /auth/refresh
      if (method === 'POST' && path === '/auth/refresh') {
        return await handleAuthRefresh(request, env);
      }

      // POST /auth/validate
      if (method === 'POST' && path === '/auth/validate') {
        return await handleAuthValidate(request, env);
      }

      // ============================================
      // ZONE PUBLIC ENDPOINTS
      // ============================================
      
      // GET /zones/validate/:zoneId
      const validateMatch = path.match(/^\/zones\/validate\/([^\/]+)$/);
      if (method === 'GET' && validateMatch) {
        return await handleZonesValidate(validateMatch[1], env);
      }

      // GET /zones/:zoneId/notes
      const zoneNotesMatch = path.match(/^\/zones\/([^\/]+)\/notes$/);
      if (method === 'GET' && zoneNotesMatch) {
        return await handleZonesNotes(zoneNotesMatch[1], env);
      }

      // ============================================
      // SESSION-BASED ENDPOINTS
      // ============================================
      
      // POST /mcp
      if (method === 'POST' && path === '/mcp') {
        return await handleMCP(request, env);
      }

      // GET /sse
      if (method === 'GET' && path === '/sse') {
        return await handleSSE(request, env, ctx);
      }

      // ============================================
      // OWNER-PROTECTED ENDPOINTS
      // ============================================
      
      // Check owner auth for protected routes
      const isProtectedRoute = 
        (method === 'POST' && path === '/sessions/create') ||
        (method === 'POST' && path === '/sessions/revoke') ||
        (method === 'GET' && path === '/sessions/list') ||
        (method === 'POST' && path === '/zones/create') ||
        (method === 'DELETE' && path.match(/^\/zones\/[^\/]+$/)) ||
        (method === 'GET' && path === '/zones/list');

      if (isProtectedRoute) {
        const ownerPayload = await verifyOwnerAuth(request, env);
        if (!ownerPayload) {
          return errorResponse('Unauthorized: Owner access required', 401);
        }
      }

      // POST /sessions/create
      if (method === 'POST' && path === '/sessions/create') {
        return await handleSessionsCreate(request, env, host);
      }

      // POST /sessions/revoke
      if (method === 'POST' && path === '/sessions/revoke') {
        return await handleSessionsRevoke(request, env);
      }

      // GET /sessions/list
      if (method === 'GET' && path === '/sessions/list') {
        return await handleSessionsList(env);
      }

      // POST /zones/create
      if (method === 'POST' && path === '/zones/create') {
        return await handleZonesCreate(request, env, host);
      }

      // DELETE /zones/:zoneId
      const zoneDeleteMatch = path.match(/^\/zones\/([^\/]+)$/);
      if (method === 'DELETE' && zoneDeleteMatch) {
        return await handleZonesDelete(zoneDeleteMatch[1], env);
      }

      // GET /zones/list
      if (method === 'GET' && path === '/zones/list') {
        return await handleZonesList(env);
      }

      // ============================================
      // 404 Not Found
      // ============================================
      return errorResponse('Not found', 404);

    } catch (err) {
      console.error('Worker error:', err);
      return errorResponse(`Internal error: ${err.message}`, 500);
    }
  }
};
```

---

## 🤖 ЗАВДАННЯ ДЛЯ COMET AGENT

### Мета
Задеплоїти Garden MCP Worker v3.0 на Cloudflare через Dashboard Quick Edit без використання wrangler CLI.

### Передумови
- Worker name: `garden-mcp-server`
- KV Namespace: `MCP_SESSIONS` (прив'язаний як `KV`)
- Environment Variables налаштовані в Settings

### Покрокова інструкція

#### КРОК 1: Відкрити Cloudflare Dashboard
```
URL: https://dash.cloudflare.com
Дія: Увійти в акаунт
```

#### КРОК 2: Перейти до Workers & Pages
```
Навігація: Workers & Pages → Overview
Знайти: garden-mcp-server
Клікнути: на назву воркера
```

#### КРОК 3: Відкрити Quick Edit
```
Вкладка: Edit Code (або Quick Edit)
Очікування: Відкриється редактор коду в браузері
```

#### КРОК 4: Замінити код
```
Дія: Видалити весь існуючий код (Ctrl+A, Delete)
Дія: Вставити повний код з цього файлу (від рядка 1 до рядка 1025)
ВАЖЛИВО: Код починається з коментаря "// Garden MCP Worker v3.0"
```

#### КРОК 5: Зберегти та задеплоїти
```
Кнопка: "Save and Deploy" (синя кнопка вгорі праворуч)
Очікування: Повідомлення "Worker deployed successfully"
Час: 5-10 секунд
```

#### КРОК 6: Перевірити Environment Variables
```
Навігація: Settings → Variables
Перевірити наявність:
  ✓ JWT_SECRET (тип: Secret)
  ✓ MINIO_ENDPOINT (тип: Text, значення: https://apiminio.exodus.pp.ua)
  ✓ MINIO_BUCKET (тип: Text, значення: mcpstorage)
  ✓ MINIO_ACCESS_KEY (тип: Secret)
  ✓ MINIO_SECRET_KEY (тип: Secret)
```

#### КРОК 7: Перевірити KV Bindings
```
Навігація: Settings → Bindings
Перевірити:
  ✓ KV Namespace: MCP_SESSIONS
  ✓ Variable name: KV
```

#### КРОК 8: Тестування /health
```
URL: https://garden-mcp-server.<subdomain>.workers.dev/health
Метод: GET
Очікувана відповідь:
{
  "status": "ok",
  "version": "3.0.0-vanilla",
  "service": "garden-mcp-server",
  "timestamp": "<ISO timestamp>",
  "endpoints": {
    "health": "/health",
    "auth": "/auth/*",
    "sessions": "/sessions/*",
    "zones": "/zones/*",
    "mcp": "/mcp",
    "sse": "/sse"
  }
}
```

#### КРОК 9: Тестування /auth/status
```
curl -X POST https://garden-mcp-server.<subdomain>.workers.dev/auth/status

Очікувана відповідь (якщо owner не налаштований):
{
  "success": true,
  "initialized": false,
  "message": "Owner not initialized. Call /auth/setup"
}
```

### Troubleshooting

| Проблема | Рішення |
|----------|---------|
| "KV is not defined" | Перевірити KV binding в Settings → Bindings |
| "JWT_SECRET is undefined" | Додати змінну в Settings → Variables |
| 500 Internal Error | Відкрити Logs → Real-time Logs для діагностики |
| CORS помилки | Перевірити, що OPTIONS запити повертають 204 |

### Валідація успішного деплою

**Чекліст:**
- [ ] Worker відповідає на `/health` зі статусом 200
- [ ] Версія відображається як `3.0.0-vanilla`
- [ ] `/auth/status` повертає JSON без помилок
- [ ] Немає помилок в Real-time Logs
- [ ] CORS headers присутні у відповідях

### Звіт про виконання

Після завершення надати звіт:
```
✅ Worker: garden-mcp-server
✅ Status: Deployed
✅ Version: 3.0.0-vanilla
✅ Health: OK
✅ Auth Status: [initialized/not initialized]
✅ Logs: No errors
✅ Ready for n8n integration
```
