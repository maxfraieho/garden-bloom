---
{"title":"lovable-prompt","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Агенти виконавці/lovable-prompt/","dgPassFrontmatter":true,"noteIcon":""}
---



TASK: Extend Export Page UI with MCP Access Management

CONTEXT:
- Existing page: Export page that selects folders/files and exports to markdown
- Current flow: User selects → User exports → User copies to clipboard
- NEW flow: User selects → User clicks "Create MCP Access" → Gets endpoint
- n8n webhook (create): Will be provided after n8n workflow setup
- n8n webhook (revoke): Will be provided after n8n workflow setup
- Note: Do NOT hardcode webhook URLs - make them configurable in environment variables

================================================
PART 1: ADD UI COMPONENTS
================================================

1. Open the export page in Lovable
2. Add new section after the current "Export" button:

    Section: "MCP Access"
    
    Below the existing export controls, add:
    
    ┌─────────────────────────────────────────┐
    │ 🔗 Create MCP Access                    │
    │                                         │
    │ Share this folder selection as an MCP   │
    │ endpoint for Claude Desktop, CLI, etc.  │
    │                                         │
    │ TTL (Time-to-Live):                     │
    │ ☐ 15 minutes                           │
    │ ☐ 1 hour (default)                     │
    │ ○ 24 hours                             │
    │ ☐ Custom: [____] minutes                │
    │                                         │
    │ [Create MCP Access] [Cancel]            │
    │                                         │
    │─────────────────────────────────────────│
    │                                         │
    │ Active MCP Endpoints:                   │
    │                                         │
    │ ┌─────────────────────────────────────┐ │
    │ │ 📍 Session: abc-123-def-456         │ │
    │ │ 🕐 Expires: 2026-01-11 02:00 UTC   │ │
    │ │ 📂 Folders: 2 selected              │ │
    │ │ 🔗 https://mcp.exodus.pp.ua/...    │ │
    │ │                                     │ │
    │ │ [Copy URL] [Instructions] [Delete] │ │
    │ └─────────────────────────────────────┘ │
    │                                         │
    └─────────────────────────────────────────┘

================================================
PART 2: COMPONENT STRUCTURE IN LOVABLE
================================================

Create these React components:

Component 1: MCPAccessPanel
- Renders the TTL selector
- Renders the "Create MCP Access" button
- Shows loading state when creating
- Shows error message if creation fails

Component 2: ActiveSessionCard
- Displays:
  * Session ID (shortened)
  * Expiration time (with countdown timer)
  * Selected folders
  * MCP endpoint URL
  * Copy, Instructions, Delete buttons
- Updates countdown every second
- Auto-removes card when TTL expires

Component 3: ConnectionInstructions Modal
- Triggered by "Instructions" button
- Shows:
  * Claude Desktop setup (with JSON config)
  * Claude CLI setup (with shell command)
  * Direct HTTP endpoint details
  * Copy buttons for each

Component 4: MCPEndpointList
- Container for displaying all active sessions
- Shows "No active sessions" when empty
- Ordered by expiration time

================================================
PART 3: ADD STATE MANAGEMENT
================================================

Using React hooks (useState, useEffect):

1. State variables:
   - activeSessions: Array<{sessionId, endpoint, expiresAt, folders}>
   - selectedTTL: number (in minutes)
   - isCreating: boolean
   - creationError: string | null
   - showInstructions: string | null (sessionId)

2. Functions:
   - handleCreateMCP(): Call n8n webhook with selected folders
   - handleDeleteMCP(sessionId): Call n8n revoke webhook
   - handleCopyEndpoint(endpoint): Copy to clipboard
   - refreshActiveSessions(): Fetch list from API or localStorage
   - updateCountdowns(): Every second, update expiration timers

3. useEffect hooks:
   - On mount: Load active sessions
   - On interval: Update countdown timers (every 1 second)
   - On interval: Refresh sessions (every 30 seconds) to detect TTL expiry
   - On unmount: Clear intervals

================================================
PART 4: API INTEGRATION
================================================

1. Get webhook URLs from environment:

```javascript
const MCP_CREATE_WEBHOOK = process.env.REACT_APP_N8N_MCP_CREATE_WEBHOOK;
const MCP_REVOKE_WEBHOOK = process.env.REACT_APP_N8N_MCP_REVOKE_WEBHOOK;

// These should be:
// - MCP_CREATE_WEBHOOK = 'https://n8n.exodus.pp.ua/webhook/[UUID]/mcp-create'
// - MCP_REVOKE_WEBHOOK = 'https://n8n.exodus.pp.ua/webhook/[UUID]/mcp-revoke'
```

2. Create MCP Access:

```javascript
async function createMCPAccess() {
  try {
    setIsCreating(true);
    setCreationError(null);
    
    const response = await fetch(MCP_CREATE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        folders: selectedFolders, // From existing export UI
        ttlMinutes: selectedTTL,
        userId: getCurrentUserId() // Or anonymous
      })
    });
    
    if (!response.ok) {
      throw new Error(`Failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Save to localStorage or state
    const newSession = {
      sessionId: data.sessionId,
      endpoint: data.mcpEndpoint,
      expiresAt: new Date(data.expiresAt),
      folders: selectedFolders,
      createdAt: new Date()
    };
    
    setActiveSessions([...activeSessions, newSession]);
    
    // Show success toast
    toast({
      title: "MCP Access Created",
      description: `Endpoint active for ${selectedTTL} minutes`,
      duration: 5000
    });
    
  } catch (error) {
    setCreationError(error.message);
    toast({
      title: "Error Creating MCP Access",
      description: error.message,
      variant: "destructive"
    });
  } finally {
    setIsCreating(false);
  }
}
```

3. Revoke MCP Access:

```javascript
async function deleteMCPAccess(sessionId) {
  try {
    const response = await fetch(MCP_REVOKE_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to revoke');
    }
    
    setActiveSessions(
      activeSessions.filter(s => s.sessionId !== sessionId)
    );
    
    toast({
      title: "MCP Access Deleted",
      description: "Session endpoint revoked"
    });
    
  } catch (error) {
    toast({
      title: "Error Deleting MCP Access",
      description: error.message,
      variant: "destructive"
    });
  }
}
```

================================================
PART 5: UI IMPLEMENTATION DETAILS
================================================

TTL Selector Component:

```jsx
<div className="space-y-2">
  <label className="text-sm font-medium">Time-to-Live</label>
  <div className="grid grid-cols-2 gap-2">
    <Button
      variant={selectedTTL === 15 ? "default" : "outline"}
      onClick={() => setSelectedTTL(15)}
      size="sm"
    >
      15 min
    </Button>
    <Button
      variant={selectedTTL === 60 ? "default" : "outline"}
      onClick={() => setSelectedTTL(60)}
      size="sm"
    >
      1 hour
    </Button>
    <Button
      variant={selectedTTL === 1440 ? "default" : "outline"}
      onClick={() => setSelectedTTL(1440)}
      size="sm"
    >
      24 hours
    </Button>
  </div>
</div>
```

Active Session Card:

```jsx
<div className="border rounded-lg p-4 space-y-3">
  <div className="flex justify-between items-start">
    <div>
      <p className="font-mono text-xs text-gray-500">
        Session ID
      </p>
      <p className="font-mono text-sm font-medium">
        {session.sessionId.substring(0, 16)}...
      </p>
    </div>
    <div className="text-right">
      <p className="text-xs text-gray-500">Expires in</p>
      <p className="text-sm font-medium text-orange-600">
        {formatTimeRemaining(session.expiresAt)}
      </p>
    </div>
  </div>
  
  <div className="space-y-2">
    <div>
      <p className="text-xs font-medium text-gray-600">Folders</p>
      <p className="text-xs">
        {session.folders.slice(0, 2).join(', ')}
        {session.folders.length > 2 && ` +${session.folders.length - 2} more`}
      </p>
    </div>
    
    <div>
      <p className="text-xs font-medium text-gray-600">MCP Endpoint</p>
      <code className="text-xs bg-gray-100 p-2 rounded block overflow-x-auto">
        {session.endpoint}
      </code>
    </div>
  </div>
  
  <div className="flex gap-2">
    <Button
      variant="outline"
      size="sm"
      onClick={() => navigator.clipboard.writeText(session.endpoint)}
    >
      📋 Copy
    </Button>
    <Button
      variant="outline"
      size="sm"
      onClick={() => setShowInstructions(session.sessionId)}
    >
      ℹ️ Instructions
    </Button>
    <Button
      variant="outline"
      size="sm"
      className="text-red-600"
      onClick={() => deleteMCPAccess(session.sessionId)}
    >
      🗑️ Delete
    </Button>
  </div>
</div>
```

================================================
PART 6: CONNECTION INSTRUCTIONS MODAL
================================================

Show different instructions for:

1. Claude Desktop:
   - Show JSON config template
   - Explain where to place file
   - Copy button for JSON

2. Claude CLI:
   - Show shell command
   - Explain installation if needed
   - Copy button for command

3. Direct API:
   - Show cURL example
   - Show HTTP headers required
   - Copy button for URL

================================================
PART 7: PERSISTENT STORAGE
================================================

Store active sessions in localStorage:

```javascript
function saveSessions() {
  localStorage.setItem(
    'mcp_active_sessions',
    JSON.stringify(activeSessions)
  );
}

function loadSessions() {
  try {
    const stored = localStorage.getItem('mcp_active_sessions');
    if (stored) {
      const sessions = JSON.parse(stored)
        .map(s => ({
          ...s,
          expiresAt: new Date(s.expiresAt)
        }))
        .filter(s => new Date() < new Date(s.expiresAt)); // Remove expired
      
      setActiveSessions(sessions);
    }
  } catch (e) {
    console.error('Failed to load sessions:', e);
  }
}

useEffect(() => {
  loadSessions();
  const interval = setInterval(() => {
    setActiveSessions(prev =>
      prev.filter(s => new Date() < s.expiresAt)
    );
  }, 60000); // Check every minute
  
  return () => clearInterval(interval);
}, []);
```

================================================
PART 8: ENVIRONMENT VARIABLES (.env)
================================================

Add to your .env file:

```
REACT_APP_N8N_MCP_CREATE_WEBHOOK=https://n8n.exodus.pp.ua/webhook/[UUID]/mcp-create
REACT_APP_N8N_MCP_REVOKE_WEBHOOK=https://n8n.exodus.pp.ua/webhook/[UUID]/mcp-revoke
```

Replace [UUID] values with actual webhook URLs from n8n workflow.

================================================
PART 9: STYLING
================================================

Use existing Tailwind classes from your project:
- Card container: border rounded-lg p-4
- Section header: text-lg font-semibold
- Status colors: text-orange-600 (expiring), text-green-600 (active)
- Code blocks: font-mono text-xs bg-gray-100
- Buttons: Use existing Button component with variant="outline"

================================================
PART 10: ERROR HANDLING
================================================

Handle these error cases:
1. No folders selected: "Please select at least one folder"
2. Network error: "Failed to create endpoint. Check connection"
3. n8n not responding: "Service temporarily unavailable"
4. Invalid TTL: "TTL must be between 5 and 1440 minutes"
5. Revoke failed: "Could not delete endpoint"

Show errors in:
- Toast notifications (temporary)
- Error state in UI (persistent until dismissed)

================================================
PART 11: FINAL INTEGRATION
================================================

Update the existing export page structure:

OLD:
[Select Folders] → [Export Button] → [Copy to Clipboard]

NEW:
[Select Folders]
  ├─ [Export Button] → [Copy to Clipboard]  (existing)
  ├─ [Create MCP Access] → [Get Endpoint]   (new)
  │   │
  │   └─ Active Sessions List
  │       ├─ Session 1: [Copy] [Instructions] [Delete]
  │       ├─ Session 2: [Copy] [Instructions] [Delete]
  │       └─ Session 3: [Copy] [Instructions] [Delete]
  └─ [Instructions Modal] (new - shows when Instructions clicked)

================================================
IMPLEMENTATION STEPS IN LOVABLE
================================================

1. Open export page in Lovable
2. Add "MCPAccessPanel" component below export section
3. Add "ActiveSessionCard" component to render sessions
4. Add "ConnectionInstructions" modal component
5. Wire up useState and useEffect hooks
6. Add environment variables to Lovable .env
7. Test with actual n8n webhook URLs
8. Test timeout/expiration logic
9. Deploy

That's it! Your UI is now MCP-ready.
