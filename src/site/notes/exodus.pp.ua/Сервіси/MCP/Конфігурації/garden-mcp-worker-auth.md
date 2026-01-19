---
ndg-publish: true
created: 2025-01-12
tags:
  - mcp
  - cloudflare
  - worker
  - auth
  - comet
  - task
---

# 🤖 COMET TASK: Cloudflare Worker для MCP Sessions + Owner Auth

## Контекст

Worker `garden-mcp-server` потрібно оновити для підтримки:
1. ✅ Owner Authentication (setup, login, validate, change-password, logout)
2. ⚠️ **MCP Sessions з snapshot даними** - зберігає notes контент в KV
3. ⚠️ Правильний формат відповіді для фронтенду

**Worker URL:** `https://garden-mcp-server.maxfraieho.workers.dev`

---

## 📋 ЗАВДАННЯ

### Крок 1: Перевір KV Namespaces

Переконайся що існують два KV namespaces:
1. `garden-auth-kv` - для auth даних
2. `garden-mcp-kv` - для MCP сесій

Якщо немає - створи в Cloudflare Dashboard → Workers & Pages → KV

---

### Крок 2: Перевір Bindings

Відкрий Worker `garden-mcp-server` → Settings → Bindings:
- `garden-auth-kv` → KV namespace `garden-auth-kv`
- `garden-mcp-kv` → KV namespace `garden-mcp-kv`

---

### Крок 3: Замінити код Worker ПОВНІСТЮ

Відкрий Worker → "Edit code" і **заміни весь код** на:

```javascript
/**
 * Garden MCP Server with Owner Authentication + MCP Snapshots
 * Cloudflare Worker v2.0
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

function errorResponse(error, status = 400) {
  return jsonResponse({ success: false, error }, status);
}

// ============ CRYPTO UTILITIES ============

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
  
  const encoder = new TextEncoder();
  const data = encoder.encode(saltHex + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return `${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;
  
  const encoder = new TextEncoder();
  const data = encoder.encode(salt + password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const computedHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return computedHash === expectedHash;
}

function generateToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ============ AUTH HANDLERS ============

async function handleAuthStatus(env) {
  const passwordHash = await env['garden-auth-kv'].get('master_password_hash');
  return jsonResponse({
    success: true,
    initialized: !!passwordHash,
  });
}

async function handleAuthSetup(request, env) {
  const existingHash = await env['garden-auth-kv'].get('master_password_hash');
  if (existingHash) {
    return errorResponse('Already initialized. Use change-password to update.', 400);
  }
  
  const body = await request.json();
  const { password } = body;
  
  if (!password || password.length < 8) {
    return errorResponse('Password must be at least 8 characters', 400);
  }
  
  const passwordHash = await hashPassword(password);
  await env['garden-auth-kv'].put('master_password_hash', passwordHash);
  
  const token = generateToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  
  await env['garden-auth-kv'].put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now(), expiresAt }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  
  return jsonResponse({
    success: true,
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

async function handleAuthLogin(request, env) {
  const passwordHash = await env['garden-auth-kv'].get('master_password_hash');
  if (!passwordHash) {
    return errorResponse('System not initialized. Run setup first.', 400);
  }
  
  const body = await request.json();
  const { password } = body;
  
  if (!password) {
    return errorResponse('Password required', 400);
  }
  
  const isValid = await verifyPassword(password, passwordHash);
  if (!isValid) {
    return errorResponse('Invalid password', 401);
  }
  
  const token = generateToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  
  await env['garden-auth-kv'].put(
    `session:${token}`,
    JSON.stringify({ createdAt: Date.now(), expiresAt }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  
  return jsonResponse({
    success: true,
    token,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

async function handleAuthValidate(request, env) {
  const body = await request.json();
  const { token } = body;
  
  if (!token) {
    return jsonResponse({ success: true, valid: false });
  }
  
  const sessionData = await env['garden-auth-kv'].get(`session:${token}`);
  if (!sessionData) {
    return jsonResponse({ success: true, valid: false });
  }
  
  try {
    const session = JSON.parse(sessionData);
    const isValid = session.expiresAt > Date.now();
    return jsonResponse({ success: true, valid: isValid });
  } catch {
    return jsonResponse({ success: true, valid: false });
  }
}

async function handleAuthChangePassword(request, env) {
  const body = await request.json();
  const { token, currentPassword, newPassword } = body;
  
  if (!token) {
    return errorResponse('Authentication required', 401);
  }
  
  const sessionData = await env['garden-auth-kv'].get(`session:${token}`);
  if (!sessionData) {
    return errorResponse('Invalid session', 401);
  }
  
  const passwordHash = await env['garden-auth-kv'].get('master_password_hash');
  if (!passwordHash || !currentPassword) {
    return errorResponse('Current password required', 400);
  }
  
  const isCurrentValid = await verifyPassword(currentPassword, passwordHash);
  if (!isCurrentValid) {
    return errorResponse('Current password is incorrect', 401);
  }
  
  if (!newPassword || newPassword.length < 8) {
    return errorResponse('New password must be at least 8 characters', 400);
  }
  
  const newPasswordHash = await hashPassword(newPassword);
  await env['garden-auth-kv'].put('master_password_hash', newPasswordHash);
  
  await env['garden-auth-kv'].delete(`session:${token}`);
  
  const newToken = generateToken();
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
  
  await env['garden-auth-kv'].put(
    `session:${newToken}`,
    JSON.stringify({ createdAt: Date.now(), expiresAt }),
    { expirationTtl: 7 * 24 * 60 * 60 }
  );
  
  return jsonResponse({
    success: true,
    token: newToken,
    expiresAt: new Date(expiresAt).toISOString(),
  });
}

async function handleAuthLogout(request, env) {
  const body = await request.json();
  const { token } = body;
  
  if (token) {
    await env['garden-auth-kv'].delete(`session:${token}`);
  }
  
  return jsonResponse({ success: true });
}

// ============ MCP SESSION HANDLERS (з snapshot даними) ============

async function handleSessionsCreate(request, env) {
  // Отримуємо body - НЕ ВИМАГАЄМО Authorization header
  const body = await request.json();
  const { folders, ttlMinutes, notes, userId, metadata } = body;

  // Валідація
  if (!folders || !Array.isArray(folders) || folders.length === 0) {
    return errorResponse('Folders array required', 400);
  }

  if (!ttlMinutes || ttlMinutes < 5 || ttlMinutes > 1440) {
    return errorResponse('TTL must be between 5 and 1440 minutes', 400);
  }

  // Генеруємо ID сесії
  const sessionId = generateToken();
  const createdAt = Date.now();
  const expiresAt = createdAt + ttlMinutes * 60 * 1000;
  const ttlSeconds = ttlMinutes * 60;

  // Підготовка snapshot даних
  const snapshot = {
    sessionId,
    createdAt: new Date(createdAt).toISOString(),
    expiresAt: new Date(expiresAt).toISOString(),
    folders,
    noteCount: notes?.length || 0,
    notes: notes || [],
    metadata: metadata || {},
  };

  // Зберігаємо snapshot в KV
  await env['garden-mcp-kv'].put(
    `session:${sessionId}`,
    JSON.stringify(snapshot),
    { expirationTtl: ttlSeconds }
  );

  // Генеруємо URLs для різних форматів
  const baseUrl = `https://garden-mcp-server.maxfraieho.workers.dev/mcp/${sessionId}`;
  
  return jsonResponse({
    success: true,
    sessionId,
    sessionUrl: baseUrl,
    expiresAt: new Date(expiresAt).toISOString(),
    noteCount: notes?.length || 0,
    storage: 'kv',
    formats: {
      json: baseUrl,
      markdown: `${baseUrl}?format=markdown`,
      jsonl: `${baseUrl}?format=jsonl`,
    },
  });
}

async function handleSessionsRevoke(request, env) {
  const body = await request.json();
  const { sessionId } = body;

  if (!sessionId) {
    return errorResponse('Session ID required', 400);
  }

  await env['garden-mcp-kv'].delete(`session:${sessionId}`);
  return jsonResponse({ success: true });
}

async function handleMCPSession(sessionId, format, env) {
  const sessionData = await env['garden-mcp-kv'].get(`session:${sessionId}`);
  
  if (!sessionData) {
    return errorResponse('Session not found or expired', 404);
  }

  try {
    const snapshot = JSON.parse(sessionData);

    // Перевіряємо чи не закінчився термін
    if (new Date(snapshot.expiresAt) < new Date()) {
      await env['garden-mcp-kv'].delete(`session:${sessionId}`);
      return errorResponse('Session expired', 410);
    }

    // Форматуємо відповідь в залежності від ?format=
    switch (format) {
      case 'markdown':
        return formatAsMarkdown(snapshot);
      case 'jsonl':
        return formatAsJSONL(snapshot);
      default:
        return jsonResponse(snapshot);
    }
  } catch (error) {
    console.error('Error parsing session:', error);
    return errorResponse('Invalid session data', 500);
  }
}

// ============ FORMAT CONVERTERS ============

function formatAsMarkdown(snapshot) {
  let md = `# Digital Garden Export\n\n`;
  md += `**Session:** ${snapshot.sessionId}\n`;
  md += `**Created:** ${snapshot.createdAt}\n`;
  md += `**Expires:** ${snapshot.expiresAt}\n`;
  md += `**Notes:** ${snapshot.noteCount}\n\n`;
  md += `---\n\n`;

  if (snapshot.notes && Array.isArray(snapshot.notes)) {
    for (const note of snapshot.notes) {
      md += `## ${note.title || note.slug}\n\n`;
      
      if (note.tags && note.tags.length > 0) {
        md += `**Tags:** ${note.tags.join(', ')}\n\n`;
      }
      
      if (note.content) {
        md += note.content + '\n\n';
      }
      
      md += `---\n\n`;
    }
  }

  return new Response(md, {
    status: 200,
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      ...corsHeaders,
    },
  });
}

function formatAsJSONL(snapshot) {
  let lines = [];
  
  // Metadata line
  lines.push(JSON.stringify({
    type: 'metadata',
    sessionId: snapshot.sessionId,
    createdAt: snapshot.createdAt,
    expiresAt: snapshot.expiresAt,
    noteCount: snapshot.noteCount,
    folders: snapshot.folders,
  }));

  // Note lines
  if (snapshot.notes && Array.isArray(snapshot.notes)) {
    for (const note of snapshot.notes) {
      lines.push(JSON.stringify({
        type: 'note',
        slug: note.slug,
        title: note.title,
        tags: note.tags || [],
        content: note.content || '',
      }));
    }
  }

  return new Response(lines.join('\n'), {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      ...corsHeaders,
    },
  });
}

// ============ MAIN ROUTER ============

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // ========== AUTH ROUTES ==========
      if (path === '/auth/status') {
        if (request.method === 'GET' || request.method === 'POST') {
          return handleAuthStatus(env);
        }
      }
      
      if (path === '/auth/setup' && request.method === 'POST') {
        return handleAuthSetup(request, env);
      }
      
      if (path === '/auth/login' && request.method === 'POST') {
        return handleAuthLogin(request, env);
      }
      
      if (path === '/auth/validate' && request.method === 'POST') {
        return handleAuthValidate(request, env);
      }
      
      if (path === '/auth/change-password' && request.method === 'POST') {
        return handleAuthChangePassword(request, env);
      }
      
      if (path === '/auth/logout' && request.method === 'POST') {
        return handleAuthLogout(request, env);
      }
      
      // ========== MCP SESSION ROUTES ==========
      if (path === '/sessions/create' && request.method === 'POST') {
        return handleSessionsCreate(request, env);
      }
      
      if (path === '/sessions/revoke' && request.method === 'POST') {
        return handleSessionsRevoke(request, env);
      }
      
      // MCP session retrieval with format support
      const mcpMatch = path.match(/^\/mcp\/([a-zA-Z0-9]+)$/);
      if (mcpMatch && request.method === 'GET') {
        const format = url.searchParams.get('format') || 'json';
        return handleMCPSession(mcpMatch[1], format, env);
      }
      
      // ========== HEALTH CHECK ==========
      if (path === '/health') {
        return jsonResponse({ 
          status: 'ok', 
          timestamp: new Date().toISOString(),
          version: '2.0',
        });
      }
      
      return errorResponse('Not found', 404);
      
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal server error: ' + error.message, 500);
    }
  },
};
```

---

### Крок 4: Save and Deploy

1. Натисни **"Save and Deploy"** у редакторі Worker
2. Дочекайся повідомлення про успішний deploy

---

### Крок 5: Тестування

#### 5.1 Health check

```bash
curl https://garden-mcp-server.maxfraieho.workers.dev/health
```

Очікувано:
```json
{"status":"ok","timestamp":"...","version":"2.0"}
```

#### 5.2 Auth status

```bash
curl https://garden-mcp-server.maxfraieho.workers.dev/auth/status
```

#### 5.3 Тест створення MCP сесії (без Auth header!)

```bash
curl -X POST https://garden-mcp-server.maxfraieho.workers.dev/sessions/create \
  -H "Content-Type: application/json" \
  -d '{"folders":["test"],"ttlMinutes":60,"notes":[{"slug":"test","title":"Test","tags":[],"content":"Hello"}]}'
```

Очікувано:
```json
{
  "success": true,
  "sessionId": "...",
  "sessionUrl": "https://garden-mcp-server.maxfraieho.workers.dev/mcp/...",
  "expiresAt": "...",
  "noteCount": 1,
  "storage": "kv",
  "formats": {
    "json": "...",
    "markdown": "...?format=markdown",
    "jsonl": "...?format=jsonl"
  }
}
```

---

## ⚠️ КЛЮЧОВІ ЗМІНИ

1. **`/sessions/create` НЕ вимагає Authorization header** - фронтенд надсилає дані напряму
2. **Зберігає notes контент в KV** - snapshot з повним вмістом нотаток
3. **Підтримує `?format=` параметр** - json, markdown, jsonl
4. **Session TTL в хвилинах** - від 5 до 1440 (24 год)

---

## ✅ Критерії Успіху

- [ ] Worker задеплоєно без помилок
- [ ] `/health` повертає `version: 2.0`
- [ ] `/sessions/create` працює БЕЗ Authorization header
- [ ] Створена сесія доступна через `/mcp/{sessionId}`
- [ ] Формати `?format=markdown` та `?format=jsonl` працюють

---

## 📝 Після успішного deploy

Повернися до Lovable UI та перевір вкладку "MCP" в Export Context діалозі - помилка HTTP 401 має зникнути.
