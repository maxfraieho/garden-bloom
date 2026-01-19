---
{"title":"Pipeline","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Pipeline/","dgPassFrontmatter":true,"noteIcon":""}
---



```
┌─────────────────────────────────────────────────────────┐
│ LOVABLE (Frontend)                                      │
│ ├─ User selects folders                                │
│ ├─ Chooses format (markdown/json/jsonl)               │
│ └─ Clicks "Export"                                      │
└─────────────────────────────────────────────────────────┘
        ↓ POST /export
┌─────────────────────────────────────────────────────────┐
│ CLOUDFLARE WORKER (Gateway)                             │
│ ├─ Validates request                                    │
│ ├─ Generates MCP ID                                     │
│ ├─ Stores metadata in KV                                │
│ └─ Triggers n8n webhook                                 │
├─────────────────────────────────────────────────────────┤
│ KV NAMESPACE (Storage)                                  │
│ └─ mcp_id → { folders, format, status, ... }          │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│ n8n WORKFLOW 1: Export Handler                          │
│ ├─ Receives export request                              │
│ ├─ Queries Supabase by folder                           │
│ ├─ Formats content                                      │
│ ├─ Creates MCP Workflow 2 via API                       │
│ └─ Returns success                                      │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│ n8n WORKFLOW 2: MCP Server (auto-created)              │
│ ├─ MCP Server Trigger node                              │
│ ├─ Exposes tools (export_folder, search_notes)         │
│ ├─ Handles tool calls                                   │
│ └─ Auto-deletes after 30 days                           │
└─────────────────────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────────────────────┐
│ SUPABASE (Data)                                         │
│ └─ Garden notes (existing, unchanged)                   │
└─────────────────────────────────────────────────────────┘

ПЕРЕВАГИ:
✅ Clear component responsibilities
✅ Persistent storage (KV)
✅ CRUD operations for MCP servers
✅ Auto-cleanup via cron
✅ Simple, maintainable pipeline
✅ Data ownership clear
✅ No impossible Claude integration
✅ Cost-effective
```

---

## CLAUDE'S ACTUAL ROLE

### ✅ Claude ДОПОМАГАЄ

```
1. Code Generation
   "Create n8n workflow JSON that..."
   → Claude generates code
   → You copy-paste into n8n
   → Done

2. Debugging
   "Why is KV put() not working?"
   → Claude explains the issue
   → You apply the fix
   → Done

3. SQL Optimization
   "How to query notes faster?"
   → Claude suggests indexes
   → You apply to Supabase
   → Done

4. Prompt Templates
   "What prompts for semantic search?"
   → Claude provides templates
   → You use in MCP tools
   → Done
```

### ❌ Claude НЕ робить

```
❌ Create API clients
❌ Deploy code
❌ Call n8n webhooks
❌ Store data
❌ Manage workflows
❌ Delete MCP servers
❌ Part of production system
```

---


### Автоматично

```
✅ Cloudflare Cron Trigger
   ├─ Time: 2:00 AM UTC daily
   ├─ Action: List KV keys
   ├─ Check: expires_at < now
   ├─ Delete: n8n workflows
   ├─ Delete: KV entries
   └─ Log: Results

✅ Result: Auto-cleanup, no manual work
```

---

## COSTS COMPARISON


```
Cloudflare Worker: FREE (100k/month)
KV Storage: FREE (1M read)
Supabase: FREE (500MB)
n8n (self-hosted): $10/month (electricity)
Claude: FREE (only as helper)
TOTAL: ~$10/month ✅
```

---

## КЛЮЧОВІ ПРИНЦИПИ 

```
1️⃣  责任SEPARATION
   Claude: Code suggestions only
   Worker: Gateway + storage
   n8n: Workflow execution + MCP server
   Lovable: UI + user interaction
   
2️⃣  DATA OWNERSHIP
   Garden notes: Supabase (unchanged)
   MCP metadata: Cloudflare KV
   MCP content: n8n (in-memory)
   
3️⃣  AUTOMATION
   Deletion: API-driven (not manual)
   Cleanup: Cron-scheduled (not manual)
   Creation: Webhook-triggered (automatic)
   
4️⃣  SIMPLICITY
   Fewer moving parts
   Clearer responsibilities
   Lower maintenance
   Lower cost
   
5️⃣  RELIABILITY
   No "magic" integration
   No external dependencies
   No impossible Claude tasks
   Clear error handling
```

