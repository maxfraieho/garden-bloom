---
{"title":"comet-prompt","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Агенти виконавці/comet-prompt/","dgPassFrontmatter":true,"noteIcon":""}
---



TASK: Deploy MCP Server Worker to Cloudflare

OBJECTIVE:
Deploy the MCP server code to Cloudflare Workers with proper configuration.
Execute each step in sequence, waiting for confirmation before proceeding.

PREREQUISITES:
- You have access to Cloudflare dashboard
- Project: garden-mcp-server
- Account: vokov's Cloudflare account
- Worker location: Will be created as new

STEP 1: Navigate to Cloudflare Workers Dashboard
--------
1. Open browser and go to https://dash.cloudflare.com
2. Log in if not already authenticated
3. In left sidebar, click "Workers and Pages"
4. Verify you see existing workers list
5. Take screenshot of dashboard
6. Proceed when ready

STEP 2: Create New Worker
--------
1. Click the blue "+ Create" button
2. Select "Create Worker"
3. In the "Create a service" dialog:
   - Service name: garden-mcp-server
   - Environment: (leave default)
4. Click "Create service"
5. Wait for worker creation to complete (may take 10-20 seconds)
6. You should see the worker editor
7. Take screenshot showing empty worker code editor
8. Proceed when ready

STEP 3: Install Dependencies & Build Setup
--------
1. Open the worker editor
2. Click "Settings" tab
3. Go to "Build configuration"
4. Set Build system: Cloudflare Workers
5. Build command: npm install && npm run build
6. Click "Save"
7. Proceed when ready

STEP 4: Upload MCP Server Code
--------
1. In Cloudflare worker editor, click "Edit code" or switch to code view
2. Clear existing placeholder code
3. Copy entire content from file mcp-server.ts (provided separately)
4. Paste into the editor
5. Click "Save and Deploy"
6. Wait for deployment (progress indicator should show green checkmark)
7. Take screenshot showing "Success! Your worker is deployed"
8. Proceed when ready

STEP 5: Setup KV Namespace
--------
1. Still in Cloudflare worker dashboard
2. Click "Settings" tab
3. Scroll to "Variables"
4. Under "KV namespace bindings":
   - Click "Add binding"
   - Variable name: GARDEN_MCP_KV
   - KV namespace: [Select existing OR create new]
     - If creating: Name it "garden-mcp-kv"
   - Click "Add binding"
5. Under "Environment variables":
   - Add: LOVABLE_API_KEY = [your API key from Lovable.dev]
   - Add: SESSION_SECRET = [generate random 32-char string like: aBcD1234eFgH5678IJkL9012MnOp3456]
   - Add: ENVIRONMENT = production
6. Click "Save"
7. Proceed when ready

STEP 6: Setup Durable Objects
--------
1. In worker settings, scroll to "Durable Objects"
2. Click "Add binding"
3. Configure:
   - Variable name: SESSION_MANAGER
   - Class name: SessionManager
   - Script: garden-mcp-server
4. For migration mode: Select "Flexible"
5. Click "Add binding"
6. Take screenshot
7. Proceed when ready

STEP 7: Configure Worker Routes
--------
1. In Cloudflare dashboard, go to "Settings" > "Triggers"
2. Under "Routes":
   - Route: mcp.exodus.pp.ua/*
   - Zone: exodus.pp.ua
   - Click "Add route"
3. For development (optional):
   - Route: mcp-dev.exodus.pp.ua/*
   - Zone: exodus.pp.ua
   - Click "Add route"
4. Save changes
5. Note: If mcp.exodus.pp.ua doesn't exist as subdomain yet, create it in Cloudflare DNS:
   - Type: CNAME
   - Name: mcp
   - Target: garden-mcp-server.workers.dev
6. Proceed when ready

STEP 8: Test Worker Deployment
--------
1. Open new browser tab
2. Navigate to: https://mcp.exodus.pp.ua/health
   (or https://garden-mcp-server.workers.dev/health if subdomain not yet active)
3. Expected response:
   {
     "status": "ok",
     "timestamp": "2026-01-11T...",
     "environment": "production"
   }
4. If you see JSON response: ✅ SUCCESS
5. If you see error: Go back to worker editor and check logs
   - Click "Logs" tab in worker dashboard
   - Look for error messages
   - Fix code issues and redeploy
6. Take screenshot of successful /health response
7. Proceed when all tests pass

STEP 9: Verify SSL/TLS Certificate
--------
1. In Cloudflare dashboard, go to "SSL/TLS"
2. Verify "Encryption mode" is set to "Full" or "Full (strict)"
3. Check "Certificate" shows valid certificate for mcp.exodus.pp.ua
4. If missing, wait 5-10 minutes for certificate issuance
5. Take screenshot
6. Proceed when ready

STEP 10: Final Verification
--------
1. Make curl request to verify Bearer token authentication:
   curl -X GET https://garden-mcp-server.workers.dev/mcp/sessions/test-session \
     -H "Authorization: Bearer test-token"
2. Expected response: 401 Unauthorized (correct - invalid token)
   If you get 404 (not found): Route issue
   If you get 500: Code error
3. Take screenshot of response
4. Open browser dev tools (F12)
5. Go to Network tab
6. Reload https://mcp.exodus.pp.ua/health (or workers.dev URL)
7. Check response headers for:
   - cf-ray: (Cloudflare request ID)
   - content-type: application/json
8. Take final screenshot
9. Proceed when verified

COMPLETION CHECKLIST:
✅ Worker deployed to garden-mcp-server
✅ /health endpoint returns status: "ok"
✅ KV namespace bound as GARDEN_MCP_KV
✅ SessionManager Durable Object configured
✅ Routes configured for mcp.exodus.pp.ua
✅ SSL/TLS active and valid
✅ Environment variables set

NEXT STEP:
After successful deployment, provide the worker details:
- Worker URL: https://garden-mcp-server.workers.dev
  (or https://mcp.exodus.pp.ua if subdomain is active)
- Session creation endpoint: POST /sessions/create
- Keep SESSION_SECRET value for n8n configuration
