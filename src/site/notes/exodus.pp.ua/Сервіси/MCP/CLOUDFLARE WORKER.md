---
{"title":"CLOUDFLARE WORKER","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/CLOUDFLARE WORKER/","dgPassFrontmatter":true,"noteIcon":""}
---



## 📦  КОД

**Ключові зміни:**
- ✅ Управління MCP серверами через n8n API
- ✅ Зберіганння метаданих в Cloudflare KV
- ✅ CRUD операції (Create, Read, Update, Delete)
- ✅ Очистка експіровані серверів
- ❌ Не генерує MCP сервери напряму (це робить n8n)

---

## PART 1: wrangler.toml Configuration

```toml
name = "garden-export-mcp"
main = "src/index.ts"
compatibility_date = "2025-01-10"

[env.production]
routes = [
  { pattern = "api.garden.example.com/*", zone_id = "your_zone_id" }
]

kv_namespaces = [
  { binding = "MCP_INSTANCES", id = "your_kv_namespace_id" }
]

vars = {
  N8N_WEBHOOK_URL = "https://your-n8n.com/webhook/export",
  N8N_API_URL = "https://your-n8n.com/api/v1",
  MCP_RETENTION_DAYS = "30",
  CORS_ORIGIN = "https://violin.pp.ua"
}

[env.production.secrets]
N8N_API_KEY = "your-n8n-api-key-here"
N8N_WEBHOOK_KEY = "your-webhook-auth-key"
BEARER_TOKEN = "your-optional-bearer-token"
```

---

## PART 2: TypeScript Worker Code

```typescript
// src/index.ts

export interface Env {
  MCP_INSTANCES: KVNamespace;
  N8N_WEBHOOK_URL: string;
  N8N_API_URL: string;
  N8N_API_KEY: string;
  N8N_WEBHOOK_KEY: string;
  MCP_RETENTION_DAYS: string;
  CORS_ORIGIN: string;
  BEARER_TOKEN: string;
}

interface MCPInstance {
  id: string;
  folders: string[];
  format: "markdown" | "json" | "jsonl";
  name: string;
  status: "pending" | "active" | "expired" | "deleted";
  created_at: string;
  expires_at: string;
  n8n_workflow_id?: string;
  sse_endpoint?: string;
  access_count: number;
  last_accessed?: string;
  created_by?: string;
  data_size_mb: number;
  retention_days: number;
}

const CORS_HEADERS = (origin: string) => ({
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
});

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || env.CORS_ORIGIN;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: CORS_HEADERS(origin),
      });
    }

    // Validate Bearer token for protected routes
    const authHeader = request.headers.get("Authorization");
    const hasAuth = authHeader === `Bearer ${env.BEARER_TOKEN}`;

    // Routes
    if (url.pathname === "/health" && request.method === "GET") {
      return handleHealth(CORS_HEADERS(origin));
    }

    if (url.pathname === "/export" && request.method === "POST") {
      return handleExport(request, env, CORS_HEADERS(origin));
    }

    if (url.pathname === "/mcp-instances" && request.method === "GET") {
      if (!hasAuth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: CORS_HEADERS(origin),
        });
      }
      return handleListInstances(env, CORS_HEADERS(origin));
    }

    if (
      url.pathname.match(/^\/mcp\/[a-zA-Z0-9_-]+$/) &&
      request.method === "GET"
    ) {
      const id = url.pathname.split("/")[2];
      return handleGetInstance(id, env, CORS_HEADERS(origin));
    }

    if (
      url.pathname.match(/^\/mcp\/[a-zA-Z0-9_-]+$/) &&
      request.method === "DELETE"
    ) {
      if (!hasAuth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: CORS_HEADERS(origin),
        });
      }
      const id = url.pathname.split("/")[2];
      return handleDeleteInstance(id, env, CORS_HEADERS(origin));
    }

    if (
      url.pathname.match(/^\/mcp\/[a-zA-Z0-9_-]+$/) &&
      request.method === "PUT"
    ) {
      if (!hasAuth) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: CORS_HEADERS(origin),
        });
      }
      const id = url.pathname.split("/")[2];
      return handleUpdateInstance(id, request, env, CORS_HEADERS(origin));
    }

    if (url.pathname === "/cleanup" && request.method === "POST") {
      return handleCleanup(env, CORS_HEADERS(origin));
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: CORS_HEADERS(origin),
    });
  },

  async scheduled(
    event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Cron job: Run cleanup daily at 2:00 AM UTC
    ctx.waitUntil(runCleanup(env));
  },
};

// ========== HANDLERS ==========

async function handleHealth(
  corsHeaders: Record<string, string>
): Promise<Response> {
  return new Response(
    JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}

async function handleExport(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const payload = await request.json() as {
      folders: string[];
      format: "markdown" | "json" | "jsonl";
      name?: string;
      retention_days?: number;
    };

    // Validate
    if (!payload.folders || !Array.isArray(payload.folders)) {
      return errorResponse(400, "Invalid folders array", corsHeaders);
    }

    if (!payload.format || !["markdown", "json", "jsonl"].includes(payload.format)) {
      return errorResponse(400, "Invalid format", corsHeaders);
    }

    // Generate unique ID
    const mcp_id = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create MCP instance object
    const now = new Date();
    const retentionDays = Math.min(
      payload.retention_days || parseInt(env.MCP_RETENTION_DAYS),
      90
    );
    const expiresAt = new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000);

    const mcp_instance: MCPInstance = {
      id: mcp_id,
      folders: payload.folders,
      format: payload.format,
      name: payload.name || `Export ${payload.folders.join(", ")}`,
      status: "pending",
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      access_count: 0,
      data_size_mb: 0,
      retention_days: retentionDays,
    };

    // Store in KV immediately (status: pending)
    await env.MCP_INSTANCES.put(
      mcp_id,
      JSON.stringify(mcp_instance),
      { expirationTtl: retentionDays * 24 * 60 * 60 }
    );

    console.log(`[Export] Created MCP instance: ${mcp_id}`);

    // Trigger n8n webhook (async - don't wait)
    const n8nPayload = {
      mcp_id,
      folders: payload.folders,
      format: payload.format,
      retention_days: retentionDays,
      timestamp: now.toISOString(),
    };

    ctx.waitUntil(
      fetch(env.N8N_WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-N8N-Key": env.N8N_WEBHOOK_KEY,
        },
        body: JSON.stringify(n8nPayload),
      })
        .then(async (response) => {
          if (!response.ok) {
            console.error(`[Export] n8n webhook failed: ${response.status}`);
            // Mark as failed in KV
            mcp_instance.status = "failed";
            await env.MCP_INSTANCES.put(mcp_id, JSON.stringify(mcp_instance));
          } else {
            // n8n will update this via API callback
            console.log(`[Export] n8n webhook succeeded for ${mcp_id}`);
          }
        })
        .catch((error) => {
          console.error(`[Export] n8n webhook error:`, error);
        })
    );

    return successResponse(202, {
      mcp_id,
      status: "pending",
      message: "MCP export initiated. Check status in a moment.",
      check_status_url: `/mcp/${mcp_id}`,
      expires_at: expiresAt.toISOString(),
    }, corsHeaders);
  } catch (error) {
    console.error("[Export] Error:", error);
    return errorResponse(500, "Internal server error", corsHeaders);
  }
}

async function handleListInstances(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const list = await env.MCP_INSTANCES.list({ prefix: "mcp_" });

    const instances: MCPInstance[] = [];
    for (const key of list.keys) {
      const data = await env.MCP_INSTANCES.get(key.name);
      if (data) {
        instances.push(JSON.parse(data));
      }
    }

    return successResponse(200, {
      total: instances.length,
      instances: instances.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    }, corsHeaders);
  } catch (error) {
    console.error("[ListInstances] Error:", error);
    return errorResponse(500, "Failed to list instances", corsHeaders);
  }
}

async function handleGetInstance(
  id: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const data = await env.MCP_INSTANCES.get(id);

    if (!data) {
      return errorResponse(404, "MCP instance not found", corsHeaders);
    }

    const instance: MCPInstance = JSON.parse(data);

    // Check if expired
    if (new Date(instance.expires_at) < new Date()) {
      instance.status = "expired";
    }

    return successResponse(200, instance, corsHeaders);
  } catch (error) {
    console.error("[GetInstance] Error:", error);
    return errorResponse(500, "Failed to get instance", corsHeaders);
  }
}

async function handleDeleteInstance(
  id: string,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const data = await env.MCP_INSTANCES.get(id);

    if (!data) {
      return errorResponse(404, "MCP instance not found", corsHeaders);
    }

    const instance: MCPInstance = JSON.parse(data);

    // Delete from n8n if workflow exists
    if (instance.n8n_workflow_id) {
      try {
        const deleteResponse = await fetch(
          `${env.N8N_API_URL}/workflows/${instance.n8n_workflow_id}`,
          {
            method: "DELETE",
            headers: {
              "X-N8N-API-KEY": env.N8N_API_KEY,
            },
          }
        );

        if (!deleteResponse.ok) {
          console.error(
            `[DeleteInstance] Failed to delete n8n workflow: ${deleteResponse.status}`
          );
          return errorResponse(
            500,
            "Failed to delete n8n workflow",
            corsHeaders
          );
        }
      } catch (error) {
        console.error("[DeleteInstance] n8n API error:", error);
        return errorResponse(500, "Failed to contact n8n API", corsHeaders);
      }
    }

    // Delete from KV
    await env.MCP_INSTANCES.delete(id);

    return successResponse(200, {
      message: "MCP instance deleted successfully",
      id,
    }, corsHeaders);
  } catch (error) {
    console.error("[DeleteInstance] Error:", error);
    return errorResponse(500, "Failed to delete instance", corsHeaders);
  }
}

async function handleUpdateInstance(
  id: string,
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const data = await env.MCP_INSTANCES.get(id);

    if (!data) {
      return errorResponse(404, "MCP instance not found", corsHeaders);
    }

    const instance: MCPInstance = JSON.parse(data);
    const updates = await request.json() as Partial<MCPInstance>;

    // Only allow updating certain fields
    if (updates.retention_days) {
      instance.retention_days = Math.min(updates.retention_days, 90);
      const expiresAt = new Date(
        new Date(instance.created_at).getTime() +
          instance.retention_days * 24 * 60 * 60 * 1000
      );
      instance.expires_at = expiresAt.toISOString();
    }

    if (updates.name) {
      instance.name = updates.name;
    }

    // Update in KV
    await env.MCP_INSTANCES.put(id, JSON.stringify(instance));

    return successResponse(200, {
      message: "MCP instance updated successfully",
      instance,
    }, corsHeaders);
  } catch (error) {
    console.error("[UpdateInstance] Error:", error);
    return errorResponse(500, "Failed to update instance", corsHeaders);
  }
}

async function handleCleanup(
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    ctx.waitUntil(runCleanup(env));

    return successResponse(202, {
      message: "Cleanup started in background",
    }, corsHeaders);
  } catch (error) {
    console.error("[Cleanup] Error:", error);
    return errorResponse(500, "Cleanup failed", corsHeaders);
  }
}

async function runCleanup(env: Env): Promise<{ deleted: number; remaining: number }> {
  const list = await env.MCP_INSTANCES.list({ prefix: "mcp_" });
  let deleted = 0;
  const now = new Date();

  for (const key of list.keys) {
    const data = await env.MCP_INSTANCES.get(key.name);
    if (data) {
      const instance: MCPInstance = JSON.parse(data);

      if (new Date(instance.expires_at) < now) {
        // Delete from n8n
        if (instance.n8n_workflow_id) {
          try {
            await fetch(
              `${env.N8N_API_URL}/workflows/${instance.n8n_workflow_id}`,
              {
                method: "DELETE",
                headers: {
                  "X-N8N-API-KEY": env.N8N_API_KEY,
                },
              }
            );
          } catch (error) {
            console.error(
              `[Cleanup] Failed to delete n8n workflow ${instance.n8n_workflow_id}:`,
              error
            );
          }
        }

        // Delete from KV
        await env.MCP_INSTANCES.delete(key.name);
        deleted++;
        console.log(`[Cleanup] Deleted expired MCP instance: ${key.name}`);
      }
    }
  }

  const remaining = list.keys.length - deleted;
  console.log(
    `[Cleanup] Completed: deleted=${deleted}, remaining=${remaining}`
  );

  return { deleted, remaining };
}

// ========== UTILITY FUNCTIONS ==========

function successResponse(
  status: number,
  data: any,
  corsHeaders: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(
  status: number,
  message: string,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      status,
    }),
    {
      status,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    }
  );
}
```

---

## PART 3: Deployment

```bash
# Install dependencies
npm install wrangler

# Test locally
wrangler dev --env production

# Deploy
wrangler deploy --env production

# Check logs
wrangler tail --env production
```

---

## PART 4: API Examples

### Create MCP Export

```bash
curl -X POST https://api.garden.example.com/export \
  -H "Content-Type: application/json" \
  -d '{
    "folders": ["/Arsenal", "/Living"],
    "format": "markdown",
    "name": "Arsenal Export",
    "retention_days": 30
  }'

# Response:
{
  "mcp_id": "mcp_1704945600_abc123",
  "status": "pending",
  "expires_at": "2026-02-10T12:00:00Z"
}
```

### List All Instances

```bash
curl -X GET https://api.garden.example.com/mcp-instances \
  -H "Authorization: Bearer your-token"

# Response:
{
  "total": 3,
  "instances": [...]
}
```

### Get Instance Details

```bash
curl -X GET https://api.garden.example.com/mcp/mcp_1704945600_abc123

# Response:
{
  "id": "mcp_1704945600_abc123",
  "status": "active",
  "sse_endpoint": "https://your-n8n.com/mcp/workflow/...",
  ...
}
```

### Delete Instance

```bash
curl -X DELETE https://api.garden.example.com/mcp/mcp_1704945600_abc123 \
  -H "Authorization: Bearer your-token"

# Response:
{
  "message": "MCP instance deleted successfully"
}
```

---

## PART 5: Monitoring

```bash
# Check Worker status
curl https://api.garden.example.com/health

# View recent errors
wrangler tail --env production --format pretty

# Monitor KV usage
wrangler kv:key list --binding MCP_INSTANCES --env production
```

---

## ⚙️ КОНФІГ ПЕРЕВІРКА

Перевір що у твого Cloudflare account:
- ✅ KV namespace created (garden-export-mcp)
- ✅ Worker deployed (garden-export-mcp)
- ✅ Environment variables set
- ✅ Secrets stored (API keys)
- ✅ Custom domain (optional but recommended)

