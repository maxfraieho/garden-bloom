---
{"title":"claude-n8n-prompt","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Агенти виконавці/claude-n8n-prompt/","dgPassFrontmatter":true,"noteIcon":""}
---



TASK: Create n8n Workflow for MCP Session Lifecycle Management

CONTEXT:
- Target n8n instance: https://n8n.exodus.pp.ua
- Cloudflare Worker endpoint: [ДОДАМ ПІСЛЯ РОЗГОРТАННЯ] 
- Goal: Automate creation, tracking, and deletion of MCP sessions
- User has folder/file selection from UI

WORKFLOW ARCHITECTURE:
This workflow will:
1. Listen for webhook from UI ("Create MCP Access")
2. Call Lovable.dev API to export selected folders
3. Prepare content for MCP storage
4. POST to Cloudflare Worker to create session
5. Return session endpoint to UI
6. Track TTL and auto-cleanup
7. Listen for webhook to revoke access

================================================
STEP 1: SETUP CREDENTIALS IN n8n
================================================

Action: Create Cloudflare Worker Credential

1. Log into https://n8n.exodus.pp.ua
2. Navigate to "Settings" → "Credentials"
3. Click "+ New" and select "HTTP Header Auth"
4. Configure:
   - Name: "Cloudflare MCP Worker"
   - Header Name: "Authorization"
   - Header Value: "Bearer YOUR_SESSION_SECRET_FROM_WRANGLER"
5. Click "Save"

Action: Create Lovable.dev API Credential

1. Still in Credentials
2. Click "+ New" and select "Generic API"
3. Configure:
   - Name: "Lovable API"
   - Base URL: https://api.lovable.dev/v1
   - Header Name: "Authorization"
   - Header Value: "Bearer YOUR_LOVABLE_API_KEY"
4. Click "Save"

================================================
STEP 2: CREATE NEW WORKFLOW
================================================

1. Click "Workflows" in left sidebar
2. Click "+ New"
3. Name: "MCP Session Manager"
4. Description: "Manage MCP session lifecycle - create, revoke, track TTL"
5. Click "Create"
6. You now have a blank canvas

================================================
STEP 3: ADD WEBHOOK TRIGGER (MCP CREATE)
================================================

Node 1: Webhook Trigger
- Name: "UI - Create MCP"
- Type: Webhook
- HTTP Method: POST
- URL: Will be auto-generated like:
  /webhook/uuid/mcp-create
- Authentication: None

Node 1 Configuration Details:
Click in the node, configure:
- HTTP Method: POST
- Response Mode: "When last node finishes"
- Response Data: First incoming item

Click "Test Webhook URL" to activate it.
Save the URL - you'll need it for the UI.

Expected incoming data structure:
{
  "folders": ["notes/AI", "notes/DevOps"],
  "ttlMinutes": 60,
  "userId": "user123"
}

================================================
STEP 4: ADD LOVABLE API EXPORT NODE
================================================

Node 2: HTTP Request
- Name: "Lovable Export Selected Folders"
- Type: HTTP Request
- Credential: "Lovable API"
- URL: https://api.lovable.dev/v1/exports

Configuration:
- Method: POST
- Send Body: Yes
- Body (JSON):
```json
{
  "folders": "={{ $json.folders.join(',') }}",
  "format": "markdown",
  "includeMetadata": true,
  "includeTags": true,
  "includeBacklinks": true
}
```

Click the node and in "Test" tab:
- Paste sample data:
```json
{
  "folders": ["notes/AI", "notes/DevOps"],
  "ttlMinutes": 60,
  "userId": "test-user"
}
```

================================================
STEP 5: ADD CONTENT TRANSFORMER NODE
================================================

Node 3: Function
- Name: "Transform Export to MCP Format"
- Type: Function
- Code:

```javascript
// Transform Lovable export to MCP session content structure

const input = $input.all()[0].json;

// Parse export response
const exportData = input.body || input;

return {
  exportedContent: {
    markdown: exportData.content || exportData.markdown || '',
    fileList: exportData.files || 
              exportData.fileList || 
              (exportData.folders ? Object.keys(exportData.folders).flat() : []),
    backlinks: exportData.backlinks || 
               exportData.metadata?.backlinks || 
               {}
  },
  folders: exportData.folders || [],
  ttlMinutes: $('UI - Create MCP').item.json.ttlMinutes,
  userId: $('UI - Create MCP').item.json.userId
};
```

================================================
STEP 6: ADD CLOUDFLARE SESSION CREATE NODE
================================================

Node 4: HTTP Request
- Name: "Cloudflare - Create MCP Session"
- Type: HTTP Request
- Credential: "Cloudflare MCP Worker"
- URL: [ДОДАЙ ПІСЛЯ РОЗГОРТАННЯ ВОРКЕРА]/sessions/create

Configuration:
- Method: POST
- Send Body: Yes
- Content-Type: application/json
- Body (JSON):
```json
{
  "folders": "={{ $json.folders }}",
  "ttlMinutes": "={{ $json.ttlMinutes }}",
  "exportedContent": "={{ $json.exportedContent }}",
  "userId": "={{ $json.userId }}"
}
```

Test: Should return:
```json
{
  "success": true,
  "sessionId": "abc-123-def...",
  "endpoint": "https://mcp.exodus.pp.ua/mcp/sessions/abc-123-def...",
  "expiresAt": "2026-01-12T01:00:00Z",
  "ttlSeconds": 3600
}
```

================================================
STEP 7: ADD RESPONSE FORMATTER
================================================

Node 5: Function
- Name: "Format Response for UI"
- Type: Function
- Code:

```javascript
const sessionData = $('Cloudflare - Create MCP Session').item.json;

return {
  success: true,
  sessionId: sessionData.sessionId,
  mcpEndpoint: sessionData.endpoint,
  expiresAt: sessionData.expiresAt,
  ttlSeconds: sessionData.ttlSeconds,
  connectionInstructions: {
    claudeDesktop: {
      config: `Add to ~/.config/Claude/claude_desktop_config.json:
{
  "mcpServers": {
    "garden": {
      "command": "curl",
      "args": ["-X", "GET", "${sessionData.endpoint}/resources", "-H", "Authorization: Bearer ${sessionData.accessToken}"]
    }
  }
}`,
    },
    claudeCLI: `claude session add-mcp --name garden --type http --url ${sessionData.endpoint}`,
    direct: `MCP Server URL: ${sessionData.endpoint}`
  }
};
```

================================================
STEP 8: ADD WEBHOOK RETURN
================================================

Node 6: Respond to Webhook
- Name: "Return Session to UI"
- Type: Respond to Webhook
- Response Body: "={{ $json }}"
- Response Code: 200

================================================
STEP 9: ADD REVOKE WEBHOOK LISTENER
================================================

Node 7: Webhook Trigger
- Name: "UI - Revoke MCP"
- Type: Webhook
- HTTP Method: POST
- URL: /webhook/uuid/mcp-revoke

Expected incoming data:
{
  "sessionId": "abc-123-def..."
}

================================================
STEP 10: ADD REVOKE ACTION NODE
================================================

Node 8: HTTP Request
- Name: "Cloudflare - Revoke Session"
- Type: HTTP Request
- Credential: "Cloudflare MCP Worker"
- URL: [ДОДАЙ ПІСЛЯ РОЗГОРТАННЯ]/mcp/sessions/={{ $json.sessionId }}/revoke

Configuration:
- Method: POST
- Send Headers: Yes
- Headers:
  - Authorization: Bearer YOUR_SESSION_SECRET

Response: Should confirm revocation

================================================
STEP 11: ADD TTL TRACKING (Optional - for auto-cleanup)
================================================

Node 9: Wait
- Name: "Wait for TTL Expiration"
- Type: Wait
- Wait Type: "Duration"
- Duration: "={{ $('Cloudflare - Create MCP Session').item.json.ttlSeconds }}"
- Unit: "seconds"

Node 10: HTTP Request
- Name: "Auto-Cleanup Expired Session"
- Type: HTTP Request
- Credential: "Cloudflare MCP Worker"
- URL: [ДОДАЙ ПІСЛЯ РОЗГОРТАННЯ]/mcp/sessions/={{ $('Cloudflare - Create MCP Session').item.json.sessionId }}/revoke
- Method: POST

This creates automatic cleanup of expired sessions.

================================================
WORKFLOW CONNECTIONS (Wire the nodes)
================================================

Connect nodes in this order:
1. UI - Create MCP
   └─→ Lovable Export Selected Folders
       └─→ Transform Export to MCP Format
           └─→ Cloudflare - Create MCP Session
               ├─→ Format Response for UI
               │   └─→ Return Session to UI
               └─→ [BRANCH] Wait for TTL Expiration
                   └─→ Auto-Cleanup Expired Session

2. UI - Revoke MCP
   └─→ Cloudflare - Revoke Session
       └─→ Respond to Webhook (with revocation confirmation)

================================================
WORKFLOW CONFIGURATION
================================================

1. Click "Workflow" menu (top)
2. Enable: "Activate workflow"
3. Save the workflow
4. Test Mode:
   - Click "Execute Workflow"
   - Should show success if credentials are valid

================================================
TEST THE WORKFLOW
================================================

Make a test request from terminal:

```bash
curl -X POST https://n8n.exodus.pp.ua/webhook/[YOUR_WEBHOOK_UUID]/mcp-create \
  -H "Content-Type: application/json" \
  -d '{
    "folders": ["notes/AI", "notes/DevOps"],
    "ttlMinutes": 60,
    "userId": "test-user"
  }'
```

Expected response:
```json
{
  "success": true,
  "sessionId": "abc-123-def...",
  "mcpEndpoint": "https://mcp.exodus.pp.ua/mcp/sessions/abc-123-def...",
  "expiresAt": "2026-01-11T02:00:00Z"
}
```

================================================
RETRIEVE WEBHOOK URLS
================================================

After saving, click "Details" to see:
- MCP Create Webhook: https://n8n.exodus.pp.ua/webhook/.../mcp-create
- MCP Revoke Webhook: https://n8n.exodus.pp.ua/webhook/.../mcp-revoke

Copy these to use in the UI configuration.

================================================
SAVE & ACTIVATE
================================================

1. Click "Save" (Ctrl+S)
2. Toggle "Active" switch to ON
3. Verify blue "Active" indicator shows at top
4. Workflow is now listening for webhooks
