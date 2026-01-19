---
{"title":"n8n WORKFLOWS - Complete Setup Guide","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/n8n WORKFLOWS - Complete Setup Guide/","dgPassFrontmatter":true,"noteIcon":""}
---



У n8n потребують 2 :
1. **Export Garden (Webhook Handler)** - receives export requests
2. **{Dynamic MCP Servers}** - created on-demand for each export

---

## WORKFLOW 1: Export Garden (Main Handler)

### Purpose
- Receives export requests from Cloudflare Worker
- Creates dynamic MCP server workflow
- Queries Supabase by folder
- Returns formatted content

### Setup Steps

#### Step 1: Create Webhook Trigger

```
Node Name: Trigger Export
Type: Webhook
Method: POST
Path: /webhook/export
Authentication: Header Auth (X-N8N-Key)

Expected Input:
{
  "mcp_id": "mcp_1704945600_abc123",
  "folders": ["/Arsenal"],
  "format": "markdown",
  "retention_days": 30
}
```

#### Step 2: Validate Input

```
Node Name: Validate Payload
Type: Code Node
Language: JavaScript

Code:
const { mcp_id, folders, format } = $input.all()[0].json;

if (!mcp_id || !folders?.length || !format) {
  throw new Error('Invalid payload: missing required fields');
}

if (!['markdown', 'json', 'jsonl'].includes(format)) {
  throw new Error('Invalid format. Use: markdown, json, jsonl');
}

return [{
  mcp_id,
  folders,
  format,
  validated: true
}];
```

#### Step 3: Query Supabase

```
Node Name: Fetch Notes by Folder
Type: Supabase
Operation: SELECT
Query:
SELECT * FROM notes 
WHERE folder IN (?) 
ORDER BY created_at DESC

Parameters: $json.folders
```

#### Step 4: Generate Workflow JSON (for MCP)

```
Node Name: Create MCP Workflow
Type: Code Node
Language: JavaScript

Code:
const { mcp_id, folders, format } = $json;
const notes = $input.all()[1].json;

// Generate MCP Server Trigger node
const workflowJSON = {
  name: `MCP Export ${mcp_id}`,
  active: true,
  nodes: [
    {
      id: "mcp_trigger",
      name: "MCP Server Trigger",
      type: "n8n-nodes-base.mcp_trigger",
      position: [250, 300],
      parameters: {
        methods: "listTools",
        tools: [
          {
            name: "export_folder",
            description: `Export ${folders.join(', ')} in ${format} format`,
            inputSchema: {
              type: "object",
              properties: {
                folder_path: {
                  type: "string",
                  description: "Folder path to export"
                }
              },
              required: ["folder_path"]
            }
          },
          {
            name: "search_notes",
            description: "Search notes by query",
            inputSchema: {
              type: "object",
              properties: {
                query: { type: "string" },
                limit: { type: "number", default: 10 }
              },
              required: ["query"]
            }
          }
        ]
      }
    },
    {
      id: "code_formatter",
      name: "Format Content",
      type: "n8n-nodes-base.code",
      position: [450, 300],
      parameters: {
        language: "javaScript",
        jsCode: `
const notes = ${JSON.stringify(notes)};
const format = "${format}";

if (format === "markdown") {
  const markdown = notes.map(note => {
    return \`---
title: \${note.title}
created: \${note.created_at}
tags: \${JSON.stringify(note.tags || [])}
---

# \${note.title}

\${note.content}\`;
  }).join('\\n\\n---\\n\\n');
  
  return [{ content: markdown, format }];
}

if (format === "json") {
  return [{ content: JSON.stringify({ notes }, null, 2), format }];
}

if (format === "jsonl") {
  const jsonl = notes.map(n => JSON.stringify(n)).join('\\n');
  return [{ content: jsonl, format }];
}

throw new Error('Invalid format');
`
      }
    },
    {
      id: "response_node",
      name: "Return Result",
      type: "n8n-nodes-base.respondToWebhook",
      position: [650, 300],
      parameters: {
        responseCode: 200,
        responseData: "$json.content",
        responseContentType": "text/plain"
      }
    }
  ],
  connections: {
    "mcp_trigger": {
      "main": [
        [
          { node: "code_formatter", branch: 0, port: 0 }
        ]
      ]
    },
    "code_formatter": {
      "main": [
        [
          { node: "response_node", branch: 0, port: 0 }
        ]
      ]
    }
  }
};

return [{
  mcp_id,
  workflow_json: workflowJSON
}];
```

#### Step 5: Create MCP Workflow via n8n API

```
Node Name: Create MCP on n8n
Type: HTTP Request
Method: POST
URL: {{ $json.n8n_api_url }}/workflows
Authentication: Header Auth
Headers:
  X-N8N-API-KEY: {{ env.N8N_API_KEY }}

Body (JSON):
{
  "name": "{{ $json.workflow_json.name }}",
  "nodes": "{{ $json.workflow_json.nodes }}",
  "connections": "{{ $json.workflow_json.connections }}",
  "settings": {
    "executionOrder": "v1"
  }
}

Expected Response:
{
  "data": {
    "id": "workflow_id",
    "name": "MCP Export ...",
    "active": true
  }
}
```

#### Step 6: Update Cloudflare KV with Workflow Details

```
Node Name: Notify Worker
Type: HTTP Request
Method: PUT
URL: {{ $json.worker_url }}/mcp/{{ $json.mcp_id }}
Authentication: Bearer Token
Token: {{ env.CLOUDFLARE_TOKEN }}

Body (JSON):
{
  "n8n_workflow_id": "{{ $json.data[0].data.id }}",
  "sse_endpoint": "https://{{ n8n_host }}/mcp/workflow/{{ $json.data[0].data.id }}",
  "status": "active"
}
```

#### Step 7: Return Success

```
Node Name: Return Success
Type: Respondto Webhook
Response Code: 201
Response Data:
{
  "success": true,
  "mcp_id": "{{ $json.mcp_id }}",
  "workflow_id": "{{ $json.data[0].data.id }}",
  "sse_endpoint": "{{ $json.sse_endpoint }}",
  "created_at": "{{ now.toISOString() }}"
}
```

---

## WORKFLOW 2: MCP Server (Auto-Created)

### Purpose
- Dynamically created for each export
- Exposes tools via MCP Server Trigger
- Handles tool calls (export_folder, search_notes)
- Auto-deletes after 30 days

### Auto-Generated Structure

```
Name: MCP Export {mcp_id}
Active: Yes (on create)

Nodes:
1. MCP Server Trigger
   ├─ Exposes 2 tools:
   │  ├─ export_folder
   │  └─ search_notes
   
2. Code Node (Tool Router)
   ├─ Check which tool was called
   ├─ Route to appropriate handler
   
3. Supabase Query
   ├─ Fetch relevant data
   
4. Code Node (Format Response)
   ├─ Format according to original request
   
5. Return Result
   └─ Send to MCP client

Connections:
MCP Trigger → Tool Router → Supabase → Formatter → Result
```

### Auto-Delete Schedule

```
Create Scheduled Trigger Workflow

Name: Delete Expired MCP Servers
Schedule: Daily at 2:00 AM

Nodes:
1. Schedule Trigger
   └─ Cron: 0 2 * * *

2. Call Cloudflare Worker
   └─ POST /cleanup
   └─ Delete all expired workflows

3. Log Results
   └─ Log deleted count
```

---

## ENVIRONMENT VARIABLES IN n8n

Set these in n8n Settings → Variables:

```
N8N_API_KEY = "your-api-key-here"
N8N_WEBHOOK_KEY = "webhook-secret-key"
CLOUDFLARE_WORKER_URL = "https://api.garden.example.com"
CLOUDFLARE_TOKEN = "cloudflare-bearer-token"
SUPABASE_URL = "https://your-project.supabase.co"
SUPABASE_KEY = "anon-key-here"
N8N_HOST = "https://your-n8n.com"
N8N_API_URL = "https://your-n8n.com/api/v1"
```

---

## API TO AUTO-MANAGE WORKFLOWS

### Endpoint: POST /webhook/export

```bash
curl -X POST https://your-n8n.com/webhook/export \
  -H "X-N8N-Key: webhook-secret-key" \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_id": "mcp_1704945600_abc123",
    "folders": ["/Arsenal"],
    "format": "markdown",
    "retention_days": 30
  }'
```

Response:
```json
{
  "success": true,
  "mcp_id": "mcp_1704945600_abc123",
  "workflow_id": "abc123workflow",
  "sse_endpoint": "https://your-n8n.com/mcp/workflow/abc123workflow",
  "created_at": "2026-01-10T12:00:00Z"
}
```

---

## TESTING WORKFLOWS

### Test 1: Export Markdown

```bash
curl -X POST https://your-n8n.com/webhook/export \
  -H "X-N8N-Key: webhook-key" \
  -H "Content-Type: application/json" \
  -d '{
    "mcp_id": "test_001",
    "folders": ["/Arsenal"],
    "format": "markdown"
  }'

# Check status
curl https://api.garden.example.com/mcp/test_001
```

### Test 2: List Active MCP Servers

```bash
curl -X GET https://api.garden.example.com/mcp-instances \
  -H "Authorization: Bearer token"
```

### Test 3: Delete MCP Server

```bash
curl -X DELETE https://api.garden.example.com/mcp/test_001 \
  -H "Authorization: Bearer token"

# Verify deletion
curl https://api.garden.example.com/mcp/test_001
# Should return 404
```

---

## IMPORTANT NOTES

1. **Workflow Names Matter**
   - Main handler: Always named "Export Garden"
   - MCP servers: Pattern "MCP Export {mcp_id}"

2. **Webhook Authentication**
   - Always use X-N8N-Key header
   - Set in n8n Settings → Webhooks

3. **Auto-Cleanup**
   - Runs daily at 2:00 AM UTC (Cloudflare cron)
   - Deletes workflows older than retention_days
   - Removes from KV store
   - Logs to n8n execution history

4. **MCP Server Tools**
   - Are read-only (cannot modify notes)
   - Use Supabase queries (filters by folder)
   - Return formatted based on original format

5. **Error Handling**
   - Webhook returns 400 for invalid input
   - Returns 500 for n8n API errors
   - Errors logged in n8n execution history

---

## PRODUCTION CHECKLIST

```
☑️ Export Garden workflow created
☑️ Webhook auth configured
☑️ Supabase queries tested
☑️ n8n API key created (separate from user key)
☑️ MCP trigger node available
☑️ Code nodes for formatting working
☑️ Cloudflare Worker integration tested
☑️ KV Store updates verified
☑️ Auto-delete cron scheduled
☑️ Error handling tested
☑️ Logs configured
```

