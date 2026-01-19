---
{"title":"АРХІТЕКТУРА - Lovable + Cloudflare Worker + n8n (REVISED)","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/АРХІТЕКТУРА - Lovable + Cloudflare Worker + n8n (REVISED)/","dgPassFrontmatter":true,"noteIcon":""}
---


## 📊 ВИЧИЩЕНА АРХІТЕКТУРА

**Що було змінено:**
- ❌ Claude НЕ частина pipeline (тільки інструмент для допомоги)
- ✅ Тільки 2 компоненти: n8n + Cloudflare Worker
- ✅ Зберіганння даних = Cloudflare KV Store
- ✅ Управління MCP серверами = n8n API + CRUD операції
- ✅ Видалення MCP серверів = API запит до n8n

---

## КОМПОНЕНТИ СИСТЕМИ

```
┌──────────────────────────────────────────────────────────┐
│ LOVABLE (Static React + Vite)                            │
│ ├─ Export Modal UI                                       │
│ ├─ Folder selection + format choice                      │
│ └─ POST → Cloudflare Worker                              │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ CLOUDFLARE WORKER (Global Edge - Gateway)                │
│ ├─ Route 1: POST /export → create MCP server on n8n      │
│ ├─ Route 2: POST /mcp-instances → list all MCP servers   │
│ ├─ Route 3: DELETE /mcp/:id → delete MCP server          │
│ ├─ Route 4: PUT /mcp/:id → update MCP server             │
│ ├─ Route 5: GET /data/:key → fetch from KV Store         │
│ ├─ KV Store = Metadata про усі MCP instances             │
│ └─ Forwarding to n8n + Error handling                    │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ n8n SERVER (Your machine/VPS)                            │
│ ├─ Webhook trigger: /webhook/export                      │
│ ├─ Receives export requests from Cloudflare Worker       │
│ ├─ Queries Supabase by folder                            │
│ ├─ Formats to markdown/json/jsonl                        │
│ ├─ MCP Server Trigger node (exposes as tools)            │
│ │   └─ Dynamically created per MCP instance              │
│ ├─ n8n API endpoint (CRUD MCP servers)                   │
│ │   └─ POST /api/v1/workflows (create)                   │
│ │   └─ DELETE /api/v1/workflows/:id (delete)             │
│ │   └─ PUT /api/v1/workflows/:id (update)                │
│ └─ Supabase query node (read data from DB)               │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│ STORAGE LAYER                                            │
│ ├─ Cloudflare KV = MCP instances metadata                │
│ │   Key: mcp_{folder}_{timestamp}                        │
│ │   Value: { folder, format, status, n8n_workflow_id }  │
│ ├─ Supabase = Garden notes (existing)                    │
│ └─ n8n Internal DB = Workflow definitions                │
└──────────────────────────────────────────────────────────┘
```

---

## DATA FLOW

### Flow 1: Create MCP Server (User exports data)

```
1️⃣ USER in LOVABLE
   └─ Clicks "Export Context" → selects folders + format
   └─ Sends POST /webhook/export to Cloudflare Worker
   
2️⃣ CLOUDFLARE WORKER (Route: POST /export)
   Request body:
   {
     "folders": ["/Arsenal", "/Living"],
     "format": "markdown",
     "name": "export_arsenal_2026-01-10"
   }
   
   Worker actions:
   ├─ Validates request
   ├─ Generates unique MCP instance ID
   ├─ Stores metadata in KV: mcp_{id} → { folders, format, status: "pending" }
   ├─ Forwards to n8n POST /webhook/export with n8n API key
   └─ Returns response with MCP instance ID

3️⃣ n8n WEBHOOK TRIGGER
   Request arrives with export request
   ├─ Supabase query node (fetch notes by folder)
   ├─ Code node (format markdown with YAML)
   ├─ MCP Server Trigger node
   │   ├─ Name: {export_name}_{mcp_id}
   │   ├─ Generates SSE endpoint
   │   └─ Activates this specific workflow
   ├─ Response node (return formatted content)
   └─ Workflow saved in n8n

4️⃣ CLOUDFLARE WORKER (Receives response)
   ├─ Updates KV: mcp_{id} → { ..., status: "active", n8n_workflow_id, sse_url }
   ├─ Returns to Lovable:
   {
     "mcp_instance_id": "mcp_abc123",
     "status": "active",
     "sse_endpoint": "https://your-n8n.com/mcp/workflow/abc123",
     "expiry": "2026-02-10T12:00:00Z"
   }

5️⃣ LOVABLE
   └─ Shows success: "MCP Server created! Will expire in 30 days"
   └─ Stores MCP instance ID locally
```

### Flow 2: List All MCP Servers

```
GET /mcp-instances
↓
Cloudflare Worker queries KV (list all keys starting with "mcp_")
↓
Returns:
[
  { id: "mcp_abc123", folders: [...], status: "active", created: "...", expires: "..." },
  { id: "mcp_def456", folders: [...], status: "active", created: "...", expires: "..." }
]
```

### Flow 3: Delete MCP Server

```
DELETE /mcp/mcp_abc123
↓
Cloudflare Worker:
├─ Removes from KV
├─ Calls n8n API: DELETE /api/v1/workflows/{workflow_id}
├─ Returns confirmation

n8n:
├─ Deactivates workflow
├─ Deletes MCP Server Trigger node
├─ Removes from database
```

### Flow 4: Access MCP Server (CLI or external tool)

```
External AI Client (Claude Desktop, etc.)
    ↓ SSE Connection
n8n MCP Server Endpoint
    ↓ SSE Stream
Claude: "Can you export /Arsenal?"
    ↓
n8n executes query
    ↓
Returns: Markdown with notes
```

---

## CLOUDFLARE WORKER ROUTES

```
┌─────────────────────────────────────────────────┐
│ ENDPOINTS                                       │
├─────────────────────────────────────────────────┤

1. POST /export
   Request: { folders[], format, name }
   Action: Create MCP server on n8n + store in KV
   Response: { mcp_id, sse_url, status }

2. GET /mcp-instances
   Action: List all MCP servers from KV
   Response: [{ id, folders, status, created, expires }]

3. GET /mcp/:id
   Action: Get specific MCP server details
   Response: { id, folders, format, status, sse_url, created, expires }

4. DELETE /mcp/:id
   Action: Delete MCP server from n8n + KV
   Response: { success, message }

5. PUT /mcp/:id
   Action: Update MCP server (extend expiry, change config)
   Response: { id, updated_at }

6. GET /health
   Action: Health check
   Response: { status: "ok" }

7. POST /cleanup
   Action: Delete expired MCP servers (cron job)
   Response: { deleted_count, remaining_count }
```

---

## CLOUDFLARE KV STORE SCHEMA

```
Namespace: garden-export-mcp

Keys Pattern:
  mcp_{folder}_{timestamp}_{random_id}

Example:
  Key: mcp_arsenal_1704945600_abc123
  
  Value:
  {
    "id": "mcp_arsenal_1704945600_abc123",
    "folders": ["/Arsenal", "/Living"],
    "format": "markdown",
    "name": "Export Arsenal 2026-01-10",
    "status": "active",           // active | pending | expired | deleted
    "created_at": "2026-01-10T12:00:00Z",
    "expires_at": "2026-02-10T12:00:00Z",
    "n8n_workflow_id": "abc123workflow",
    "sse_endpoint": "https://your-n8n.com/mcp/workflow/abc123",
    "access_count": 5,
    "last_accessed": "2026-01-10T14:30:00Z",
    "created_by": "user@example.com",
    "data_size_mb": 0.5,
    "expiry_reason": "auto",      // auto | manual | on-demand
    "retention_days": 30
  }

Indexes (via Worker code):
  - By status: mcp:active, mcp:expired
  - By created_at: range queries
  - By folder: mcp:arsenal, mcp:living
```

---

## n8n INTEGRATION

### Webhook Handler

```
Workflow Name: "Export Garden - Webhook Handler"
Trigger: Webhook (POST /webhook/export)

Nodes:
1. Webhook Trigger
   └─ Path: /webhook/export
   └─ Auth: API Key (from env)

2. Code Node - Validate Input
   └─ Check folders, format
   └─ Generate MCP instance ID

3. Supabase Query Node
   └─ SELECT * FROM notes WHERE folder IN (?)
   └─ Parameterized query

4. Code Node - Format
   └─ Convert to markdown/json/jsonl
   └─ Add YAML frontmatter

5. MCP Server Trigger Node (CONDITIONAL)
   └─ IF format == "mcp" THEN create MCP server
   └─ Name: {export_name}_{mcp_id}
   └─ Generates SSE endpoint

6. Response Node
   └─ Return formatted content OR error
```

### MCP Server Workflow (Dynamic)

```
Workflow Name: "{export_name}_{mcp_id}"
Trigger: MCP Server Trigger

Tools Exposed:
1. export_folder(folder_path)
   └─ Returns folder content in chosen format

2. search_notes(query)
   └─ Semantic search in folder

3. get_metadata(folder_path)
   └─ Returns folder stats

4. export_and_format(folder, format)
   └─ Custom formatting options

Nodes:
├─ MCP Server Trigger
├─ Switch/If node (tool router)
├─ Supabase Query (context)
├─ Code node (formatting)
└─ Response node
```

### n8n API Endpoints Used

```
CREATE MCP Workflow:
POST /api/v1/workflows
{
  "name": "Export Arsenal 2026-01-10",
  "nodes": [...],
  "connections": {...},
  "active": true
}

LIST Workflows:
GET /api/v1/workflows?filter={"name":"Export%"}

GET Workflow Details:
GET /api/v1/workflows/{id}

DELETE Workflow:
DELETE /api/v1/workflows/{id}

UPDATE Workflow:
PUT /api/v1/workflows/{id}
{ "active": false, ... }

ACTIVATE/DEACTIVATE:
PATCH /api/v1/workflows/{id}
{ "active": true/false }
```

---

## CLAUDE'S ROLE (Limited)

### ✅ Claude CAN do:
```
1. Help generate n8n workflow JSON
   Input: "Create MCP server that exports Arsenal folder"
   Output: JSON workflow definition
   You: Import into n8n manually

2. Suggest Supabase queries
   Input: "How to query notes by folder?"
   Output: SQL template

3. Help debug TypeScript Worker code
   Input: "KV not storing data"
   Output: Code fix

4. Suggest prompt templates for MCP tools
   Input: "What prompts for semantic search?"
   Output: Prompt templates
```

### ❌ Claude CANNOT do:
```
❌ Create MCP servers directly (no access to n8n/Cloudflare APIs)
❌ Deploy code (that's your job via git/Comet)
❌ Store data (no persistent storage)
❌ Call n8n webhooks (not part of pipeline)
```

---

## DATA OWNERSHIP & STORAGE STRATEGY

### Where Data Lives:

```
GARDEN NOTES (Existing):
├─ Location: Supabase PostgreSQL
├─ Owned by: You
├─ Access: n8n reads via Supabase API key
├─ Backup: Supabase automated backups
└─ Retention: Indefinite (your data)

EXPORTED MCP SERVERS (Metadata):
├─ Location: Cloudflare KV Store
├─ Owned by: You (via Cloudflare account)
├─ Access: Cloudflare Worker reads/writes
├─ Backup: Cloudflare KV automatic replication
├─ Retention: 30 days (auto-cleanup via cron)
└─ Contents: Metadata only (no note content!)

EXPORTED CONTENT (Temporary):
├─ Location: n8n workflow (in-memory during execution)
├─ Owned by: n8n instance (your server)
├─ Access: Only within that workflow execution
├─ Backup: Not needed (generated on-demand)
├─ Retention: Duration of MCP server (30 days default)
└─ Contents: Formatted notes (markdown/json)

N8N WORKFLOWS (Definitions):
├─ Location: n8n PostgreSQL database (your server)
├─ Owned by: You
├─ Access: n8n internal + API
├─ Backup: Your responsibility (pg_dump)
└─ Retention: 30 days (auto-delete via cron)
```

### Data Flow Diagram:

```
Supabase              Cloudflare           n8n               Client
  ├─ notes            KV Store             DB
  │  │                │                    │
  │  └──────[read]────→ Metadata ←────────MCP definition
  │                   (mcp_id)
  │
  └──────[fetch]─────→ Worker ────→ Webhook ───→ Query ─→ Supabase
                                       │
                                       └──→ Format
                                       │
                                       └──→ MCP Server Trigger
                                       │
                                       └──→ Return to Worker
                                       │
                                       └──→ KV Update (status)
```

---

## RETENTION & CLEANUP POLICY

### Automatic Cleanup

```
Trigger: Daily cron job (Cloudflare Worker Cron)
Time: 2:00 AM UTC

Process:
1. List all keys in KV matching "mcp_*"
2. Check expires_at for each
3. If expires_at < now:
   ├─ Get n8n_workflow_id
   ├─ Call n8n API: DELETE /api/v1/workflows/{id}
   ├─ Delete from KV
   └─ Log deleted count
4. Return: { deleted: 5, remaining: 12 }

Retention Options:
- Default: 30 days
- Custom: Pass "retention_days" in export request
- Max: 90 days
- Min: 1 day
```

### Manual Deletion

```
DELETE /mcp/{mcp_id}

Cloudflare Worker:
1. Validates auth (Bearer token)
2. Gets n8n_workflow_id from KV
3. Calls n8n: DELETE /api/v1/workflows/{id}
4. Deletes from KV
5. Returns confirmation

n8n:
- Deactivates MCP Server workflow
- Removes from database
- No data recovery (permanent)
```

---

## SECURITY CONSIDERATIONS

### Data Access Control

```
❌ EXPOSED:
  - Garden notes (anyone with Supabase key)
  - MCP server list (anyone with Worker URL)
  - MCP server content (requires SSE endpoint + Bearer token)

✅ PROTECTED:
  - n8n workflows (Bearer token required)
  - Cloudflare KV (behind Worker auth)
  - Deletion operations (API key verification)
```

### API Authentication

```
n8n API Key:
├─ Stored in Cloudflare Worker secrets
├─ Used for: CREATE/UPDATE/DELETE workflows
├─ Rotation: Every 90 days
└─ Scope: Admin (full access)

Cloudflare Bearer Token:
├─ Optional (can be public or protected)
├─ Used for: /mcp-instances, /health endpoints
├─ Should hide: Production URLs
└─ Rate limit: 100 requests/minute

MCP SSE Endpoint:
├─ URL is public (in KV)
├─ Auth: Bearer token (optional, set in n8n)
├─ Cannot modify workflows (read-only tools)
└─ Can expire: Automatic after retention period
```

---

## CLAUDE AS HELPER TOOL

### Workflow 1: Generate n8n Workflow JSON

```
You: "Create a workflow that exports /Arsenal as JSON with embeddings"

Claude generates:
{
  "name": "Export Arsenal JSON",
  "nodes": [
    { "type": "webhook", "name": "Trigger", ... },
    { "type": "supabase", "name": "Query", ... },
    { "type": "codeNode", "name": "Format", ... },
    { "type": "mcp_server", "name": "MCP", ... }
  ]
}

You: 
1. Copy JSON
2. Import into n8n via API or UI
3. Adjust nodes as needed
4. Activate
```

### Workflow 2: Debug Worker Code

```
You: "KV put() is not storing data. Why?"

Claude: "Check these issues:
1. KV binding in wrangler.toml?
2. await keyword used?
3. Key exceeds 512 bytes?

Here's the fix: [code]"

You: Apply fix, redeploy Worker
```

### Workflow 3: Optimize Supabase Query

```
You: "Query is slow when exporting large folders"

Claude: "Add indexes:
CREATE INDEX idx_notes_folder ON notes(folder);
CREATE INDEX idx_notes_tags ON notes USING GIN(tags);"

You: Apply migration in Supabase UI
```

---

## COST ANALYSIS

```
MONTHLY COSTS:

Cloudflare Worker:
├─ Free tier: 100k requests/month
├─ KV: Free tier (1M read + 100k writes)
├─ Estimated: 500 exports/month
└─ Cost: FREE ✅

n8n (Self-hosted on Orange Pi):
├─ Server: ~$0 (your hardware)
├─ Electricity: ~$10/month
├─ Bandwidth: ~$0 (your ISP)
└─ Cost: $10/month ✅

Supabase (Existing):
├─ Free tier: 500MB
├─ Estimated: 200MB used
└─ Cost: FREE ✅

TOTAL: ~$10/month (server electricity only)
```

---

## NEXT STEPS (IMPLEMENTATION ORDER)

```
PHASE 1: Foundation (Week 1)
├─ Setup Cloudflare Worker with KV
├─ Create n8n webhook handler
├─ Test export flow (Lovable → Worker → n8n)

PHASE 2: MCP Integration (Week 2)
├─ Add MCP Server Trigger to n8n
├─ Implement dynamic workflow creation
├─ Test SSE connection

PHASE 3: Management (Week 3)
├─ Add list/delete endpoints
├─ Implement cleanup cron
├─ Add Lovable UI for management

PHASE 4: Production (Week 4)
├─ Load testing
├─ Monitoring setup
├─ Documentation
```

---

**КЛЮЧОВА ВІДМІННІСТЬ:**
- ❌ Claude НЕ teil системи - це tool для помощи
- ✅ Лише n8n + Cloudflare Worker = повна система
- ✅ Ти контролюєш весь код і deployment

