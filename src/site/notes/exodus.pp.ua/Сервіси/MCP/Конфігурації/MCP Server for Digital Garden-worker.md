---
{"title":"MCP Server for Digital Garden-worker","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Конфігурації/MCP Server for Digital Garden-worker/","dgPassFrontmatter":true,"noteIcon":""}
---


```javascript
// MCP Server for Digital Garden
// Architecture: Browser → Worker (CORS) → MinIO (JSON snapshots) + KV (metadata)
// Supports: ?format=json (default) | markdown | jsonl

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function corsResponse(body, status = 200, contentType = 'application/json') {
  const responseBody = contentType === 'application/json' 
    ? JSON.stringify(body) 
    : body;
  
  return new Response(responseBody, {
    status,
    headers: { 'Content-Type': contentType, ...CORS_HEADERS }
  });
}

// ============================================================
// FORMAT CONVERTERS
// ============================================================

/**
 * Convert JSON snapshot to Markdown + YAML format
 */
function jsonToMarkdown(snapshot) {
  const header = [
    '---',
    `session_id: ${snapshot.sessionId}`,
    `created_at: ${snapshot.createdAt}`,
    `expires_at: ${snapshot.expiresAt}`,
    `folders: [${snapshot.folders.map(f => `"${f}"`).join(', ')}]`,
    `note_count: ${snapshot.notes?.length || 0}`,
    '---',
    '',
    '# MCP Snapshot',
    '',
  ].join('\n');

  const notes = (snapshot.notes || []).map(note => {
    const noteHeader = [
      `## ${note.title || note.slug}`,
      '',
      `> **Slug:** \`${note.slug}\``,
      note.tags?.length ? `> **Tags:** ${note.tags.map(t => `#${t}`).join(' ')}` : '',
      '',
      '---',
      '',
    ].filter(Boolean).join('\n');
    
    return noteHeader + (note.content || '') + '\n\n---\n';
  }).join('\n');

  return header + notes;
}

/**
 * Convert JSON snapshot to JSON Lines format (one note per line)
 */
function jsonToJsonl(snapshot) {
  const lines = [];
  
  // First line: metadata
  lines.push(JSON.stringify({
    type: 'metadata',
    sessionId: snapshot.sessionId,
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt,
    folders: snapshot.folders,
    noteCount: snapshot.notes?.length || 0
  }));
  
  // Following lines: one note per line
  for (const note of (snapshot.notes || [])) {
    lines.push(JSON.stringify({
      type: 'note',
      slug: note.slug,
      title: note.title,
      tags: note.tags || [],
      content: note.content
    }));
  }
  
  return lines.join('\n');
}

// ============================================================
// MINIO S3-COMPATIBLE STORAGE
// ============================================================

async function uploadToMinIO(env, sessionId, snapshotJson) {
  const endpoint = env.MINIO_ENDPOINT;
  const bucket = env.MINIO_BUCKET;
  const key = `mcp/${sessionId}/snapshot.json`;
  const content = JSON.stringify(snapshotJson);
  
  const url = `${endpoint}/${bucket}/${key}`;
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
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
  ].join('\n') + '\n';
  
  const signedHeaders = 'content-type;host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
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
  
  const kDate = await hmacSha256(`AWS4${env.MINIO_SECRET_KEY}`, dateStamp);
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

async function deleteFromMinIO(env, sessionId) {
  const endpoint = env.MINIO_ENDPOINT;
  const bucket = env.MINIO_BUCKET;
  const key = `mcp/${sessionId}/snapshot.json`;
  
  const url = `${endpoint}/${bucket}/${key}`;
  const date = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = date.substring(0, 8);
  
  const method = 'DELETE';
  const payloadHash = await sha256('');
  
  const canonicalUri = `/${bucket}/${key}`;
  const host = new URL(endpoint).host;
  
  const canonicalHeaders = [
    `host:${host}`,
    `x-amz-content-sha256:${payloadHash}`,
    `x-amz-date:${date}`,
  ].join('\n') + '\n';
  
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  
  const canonicalRequest = [
    method,
    canonicalUri,
    '',
    canonicalHeaders,
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
  
  const kDate = await hmacSha256(`AWS4${env.MINIO_SECRET_KEY}`, dateStamp);
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

async function fetchFromMinIO(env, sessionId) {
  // For public bucket, direct GET works
  const url = `${env.MINIO_ENDPOINT}/${env.MINIO_BUCKET}/mcp/${sessionId}/snapshot.json`;
  const response = await fetch(url);
  
  if (!response.ok) {
    return null;
  }
  
  return await response.json();
}

// ============================================================
// CRYPTO HELPERS (AWS Signature V4)
// ============================================================

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  return [...new Uint8Array(hashBuffer)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(key, message) {
  const keyBuffer = typeof key === 'string' ? new TextEncoder().encode(key) : key;
  const msgBuffer = new TextEncoder().encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  
  return new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, msgBuffer));
}

async function hmacSha256Hex(key, message) {
  const sig = await hmacSha256(key, message);
  return [...sig].map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateToken(length) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    token += charset[arr[i] % charset.length];
  }
  return token;
}

// ============================================================
// MAIN WORKER
// ============================================================

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // Health check
    if (path === '/health') {
      return corsResponse({
        status: 'ok',
        timestamp: new Date().toISOString(),
        environment: env.ENVIRONMENT || 'production',
        storage: env.MINIO_ENDPOINT ? 'minio' : 'kv-only',
        formats: ['json', 'markdown', 'jsonl']
      });
    }

    // ========== CREATE SESSION ==========
    if (path === '/sessions/create' && request.method === 'POST') {
      try {
        const payload = await request.json();
        
        if (!payload.folders || !Array.isArray(payload.folders)) {
          return corsResponse({ error: 'Invalid folders' }, 400);
        }

        const sessionId = crypto.randomUUID();
        const accessToken = generateToken(32);
        const ttl = payload.ttlMinutes || 60;
        const expiresAt = new Date(Date.now() + ttl * 60000);

        // Build canonical JSON snapshot
        const snapshot = {
          sessionId,
          createdAt: new Date().toISOString(),
          expiresAt: expiresAt.toISOString(),
          folders: payload.folders,
          notes: payload.notes || []
        };

        // Upload to MinIO as JSON
        let storageInfo = null;
        if (env.MINIO_ENDPOINT && env.MINIO_ACCESS_KEY && env.MINIO_SECRET_KEY) {
          try {
            storageInfo = await uploadToMinIO(env, sessionId, snapshot);
            console.log(`Snapshot uploaded to MinIO: ${storageInfo.key}`);
          } catch (minioError) {
            console.error('MinIO upload failed, falling back to KV:', minioError);
          }
        }

        // Store metadata in KV
        const metadata = {
          sessionId,
          folders: payload.folders,
          noteCount: snapshot.notes.length,
          createdAt: snapshot.createdAt,
          expiresAt: snapshot.expiresAt,
          accessToken,
          storage: storageInfo ? 'minio' : 'kv',
          snapshotKey: storageInfo?.key || null
        };

        const kvPromises = [
          env.GARDEN_MCP_KV.put(
            `session:${sessionId}:metadata`,
            JSON.stringify(metadata),
            { expirationTtl: ttl * 60 }
          ),
          env.GARDEN_MCP_KV.put(
            `token:${accessToken}:sessionId`,
            sessionId,
            { expirationTtl: ttl * 60 }
          )
        ];

        // Fallback: store in KV if MinIO failed
        if (!storageInfo) {
          kvPromises.push(
            env.GARDEN_MCP_KV.put(
              `session:${sessionId}:content`,
              JSON.stringify(snapshot),
              { expirationTtl: ttl * 60 }
            )
          );
        }

        await Promise.all(kvPromises);

        // Notify n8n (optional)
        if (env.N8N_WEBHOOK_URL) {
          try {
            await fetch(env.N8N_WEBHOOK_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(env.N8N_WEBHOOK_KEY && { 'X-N8N-Key': env.N8N_WEBHOOK_KEY })
              },
              body: JSON.stringify({
                action: 'session_created',
                sessionId,
                folders: payload.folders,
                noteCount: snapshot.notes.length,
                ttlMinutes: ttl,
                storage: storageInfo ? 'minio' : 'kv'
              })
            });
          } catch (n8nError) {
            console.error('n8n notification failed:', n8nError);
          }
        }

        const sessionUrl = `${url.origin}/mcp/${sessionId}`;

        return corsResponse({
          success: true,
          sessionId,
          sessionUrl,
          accessToken: accessToken.substring(0, 8) + '...',
          expiresAt: expiresAt.toISOString(),
          noteCount: snapshot.notes.length,
          storage: storageInfo ? 'minio' : 'kv',
          formats: {
            json: `${sessionUrl}?format=json`,
            markdown: `${sessionUrl}?format=markdown`,
            jsonl: `${sessionUrl}?format=jsonl`
          }
        }, 201);

      } catch (err) {
        console.error('Create session error:', err);
        return corsResponse({ error: 'Failed to create session' }, 500);
      }
    }

    // ========== REVOKE SESSION ==========
    if (path === '/sessions/revoke' && request.method === 'POST') {
      try {
        const payload = await request.json();
        
        if (!payload.sessionId) {
          return corsResponse({ error: 'Missing sessionId' }, 400);
        }

        const { sessionId } = payload;
        const metadataStr = await env.GARDEN_MCP_KV.get(`session:${sessionId}:metadata`);
        
        if (metadataStr) {
          const metadata = JSON.parse(metadataStr);
          
          // Delete from MinIO
          if (metadata.storage === 'minio' && env.MINIO_ENDPOINT) {
            try {
              await deleteFromMinIO(env, sessionId);
              console.log(`Snapshot deleted from MinIO: mcp/${sessionId}/snapshot.json`);
            } catch (minioError) {
              console.error('MinIO delete failed:', minioError);
            }
          }
          
          // Delete KV keys
          await Promise.all([
            env.GARDEN_MCP_KV.delete(`session:${sessionId}:metadata`),
            env.GARDEN_MCP_KV.delete(`session:${sessionId}:content`),
            metadata.accessToken && env.GARDEN_MCP_KV.delete(`token:${metadata.accessToken}:sessionId`)
          ].filter(Boolean));
        }

        // Notify n8n
        if (env.N8N_REVOKE_WEBHOOK_URL) {
          try {
            await fetch(env.N8N_REVOKE_WEBHOOK_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(env.N8N_WEBHOOK_KEY && { 'X-N8N-Key': env.N8N_WEBHOOK_KEY })
              },
              body: JSON.stringify({ action: 'session_revoked', sessionId })
            });
          } catch (n8nError) {
            console.error('n8n revoke notification failed:', n8nError);
          }
        }

        return corsResponse({ success: true, sessionId });

      } catch (err) {
        console.error('Revoke session error:', err);
        return corsResponse({ error: 'Failed to revoke session' }, 500);
      }
    }

    // ========== GET SESSION (MCP endpoint with format support) ==========
    if (path.startsWith('/mcp/') && request.method === 'GET') {
      const sessionId = path.replace('/mcp/', '');
      const format = url.searchParams.get('format') || 'json';
      
      // Validate format
      if (!['json', 'markdown', 'jsonl'].includes(format)) {
        return corsResponse({ 
          error: 'Invalid format. Supported: json, markdown, jsonl' 
        }, 400);
      }
      
      // Get metadata
      const metadataStr = await env.GARDEN_MCP_KV.get(`session:${sessionId}:metadata`);
      
      if (!metadataStr) {
        return corsResponse({ error: 'Session not found or expired' }, 404);
      }

      const metadata = JSON.parse(metadataStr);
      
      // Fetch snapshot (JSON is canonical source)
      let snapshot = null;
      
      if (metadata.storage === 'minio' && env.MINIO_ENDPOINT) {
        try {
          snapshot = await fetchFromMinIO(env, sessionId);
        } catch (fetchError) {
          console.error('Failed to fetch from MinIO:', fetchError);
        }
      }
      
      // Fallback to KV
      if (!snapshot) {
        const contentStr = await env.GARDEN_MCP_KV.get(`session:${sessionId}:content`);
        if (contentStr) {
          snapshot = JSON.parse(contentStr);
        }
      }

      if (!snapshot) {
        return corsResponse({ error: 'Snapshot data not available' }, 500);
      }

      // Return in requested format
      switch (format) {
        case 'markdown':
          return corsResponse(
            jsonToMarkdown(snapshot), 
            200, 
            'text/markdown; charset=utf-8'
          );
        
        case 'jsonl':
          return corsResponse(
            jsonToJsonl(snapshot), 
            200, 
            'application/x-ndjson; charset=utf-8'
          );
        
        case 'json':
        default:
          return corsResponse(snapshot, 200, 'application/json');
      }
    }

    return corsResponse({ error: 'Not found' }, 404);
  }
};
```

## API Reference

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check |
| `POST` | `/sessions/create` | Create new MCP session |
| `POST` | `/sessions/revoke` | Revoke existing session |
| `GET` | `/mcp/{sessionId}` | Get snapshot (default: JSON) |
| `GET` | `/mcp/{sessionId}?format=markdown` | Get as Markdown + YAML |
| `GET` | `/mcp/{sessionId}?format=jsonl` | Get as JSON Lines |

### Create Session Request

```json
{
  "folders": ["exodus.pp.ua/Сервіси/MCP"],
  "ttlMinutes": 60,
  "notes": [
    {
      "slug": "path/to/note",
      "title": "Note Title",
      "tags": ["mcp", "docs"],
      "content": "# Full markdown content..."
    }
  ]
}
```

### Create Session Response

```json
{
  "success": true,
  "sessionId": "abc-123-def",
  "sessionUrl": "https://worker.dev/mcp/abc-123-def",
  "expiresAt": "2025-01-12T12:00:00.000Z",
  "noteCount": 5,
  "storage": "minio",
  "formats": {
    "json": "https://worker.dev/mcp/abc-123-def?format=json",
    "markdown": "https://worker.dev/mcp/abc-123-def?format=markdown",
    "jsonl": "https://worker.dev/mcp/abc-123-def?format=jsonl"
  }
}
```

## Output Formats

### JSON (default)

```json
{
  "sessionId": "abc-123",
  "createdAt": "2025-01-11T10:00:00.000Z",
  "expiresAt": "2025-01-11T11:00:00.000Z",
  "folders": ["exodus.pp.ua/Сервіси/MCP"],
  "notes": [
    {
      "slug": "path/to/note",
      "title": "Note Title",
      "tags": ["tag1", "tag2"],
      "content": "# Markdown content..."
    }
  ]
}
```

### Markdown + YAML

```markdown
---
session_id: abc-123
created_at: 2025-01-11T10:00:00.000Z
expires_at: 2025-01-11T11:00:00.000Z
folders: ["exodus.pp.ua/Сервіси/MCP"]
note_count: 5
---

# MCP Snapshot

## Note Title

> **Slug:** `path/to/note`
> **Tags:** #tag1 #tag2

---

# Markdown content...

---
```

### JSON Lines

```jsonl
{"type":"metadata","sessionId":"abc-123","createdAt":"...","expiresAt":"...","folders":["..."],"noteCount":5}
{"type":"note","slug":"path/to/note","title":"Note Title","tags":["tag1"],"content":"..."}
{"type":"note","slug":"another/note","title":"Another Note","tags":[],"content":"..."}
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MINIO_ENDPOINT` | **Yes** | MinIO server URL |
| `MINIO_ACCESS_KEY` | **Yes** | MinIO access key |
| `MINIO_SECRET_KEY` | **Yes** | MinIO secret key |
| `MINIO_BUCKET` | **Yes** | Bucket: `mcpstorage` |
| `N8N_WEBHOOK_URL` | No | n8n session created webhook |
| `N8N_REVOKE_WEBHOOK_URL` | No | n8n session revoked webhook |
| `N8N_WEBHOOK_KEY` | No | n8n auth key |
| `ENVIRONMENT` | No | production/staging |

## KV Namespace

Create `GARDEN_MCP_KV` and bind to Worker.

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Storage Architecture                         │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  MinIO (mcpstorage)                 Cloudflare KV               │
│  ┌────────────────────┐            ┌────────────────────┐       │
│  │ mcp/{id}/          │            │ session:{id}:      │       │
│  │   snapshot.json    │◄───────────│   metadata         │       │
│  │   (canonical)      │  pointer   │                    │       │
│  └────────────────────┘            │ token:{tok}:       │       │
│           │                        │   sessionId        │       │
│           │                        └────────────────────┘       │
│           ▼                                                      │
│  ┌────────────────────────────────────────────────────┐         │
│  │              Cloudflare Worker                      │         │
│  │  GET /mcp/{id}?format=json|markdown|jsonl          │         │
│  │                                                     │         │
│  │  1. Fetch JSON from MinIO                          │         │
│  │  2. Convert to requested format                    │         │
│  │  3. Return with proper Content-Type                │         │
│  └────────────────────────────────────────────────────┘         │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```
