---
{"title":"ДЕТАЛЬНИЙ ЗВІТ ПРО РОЗГОРТАННЯ MCP SERVER ТА N8N WORKFLOW","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Агенти виконавці/ДЕТАЛЬНИЙ ЗВІТ ПРО РОЗГОРТАННЯ MCP SERVER ТА N8N WORKFLOW/","dgPassFrontmatter":true,"noteIcon":""}
---



**Дата виконання**: 11 січня 2026, 16:00 EET  
**Проект**: MCP Session Manager  
**Середовище**: Cloudflare Workers + n8n

---

## 🎯 EXECUTIVE SUMMARY

Успішно розгорнуто повнофункціональну інфраструктуру для управління MCP сесіями, що складається з Cloudflare Worker backend та автоматизованого n8n workflow. Система готова до інтеграції з фронтенд-інтерфейсом.

---

## 📋 ЗМІСТ ЗВІТУ

1. [Архітектура системи](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#architecture)
    
2. [Cloudflare Worker: Детальна конфігурація](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#cloudflare)
    
3. [n8n Workflow: Покрокова структура](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#n8n-workflow)
    
4. [Credentials та Security](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#security)
    
5. [API Endpoints та інтеграція](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#api)
    
6. [Рекомендації для фронтенд розробки](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#frontend)
    
7. [Deployment Checklist](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#checklist)
    
8. [Troubleshooting Guide](https://www.perplexity.ai/sidecar/search/task-deploy-mcp-server-worker-n48GHcLiSYm7VmfTCiTWPA#troubleshooting)
    

---

## <a name="architecture"></a>🏗️ 1. АРХІТЕКТУРА СИСТЕМИ

## 1.1 Компоненти екосистеми

text

`┌─────────────────┐ │  Frontend UI    │ (наступний етап) │  lovable.dev    │ └────────┬────────┘          │ HTTPS POST         ▼ ┌─────────────────────────────────┐ │  n8n Webhook Endpoint           │ │  POST /webhook/mcp-create       │ │  https://n8n.exodus.pp.ua       │ └────────┬────────────────────────┘          │         │ 1. Webhook Trigger         │ 2. HTTP Request         │ 3. Transform Data         │ 4. Format Response         │ 5. Send Response         ▼ ┌─────────────────────────────────┐ │  Cloudflare Worker              │ │  garden-mcp-server              │ │  /sessions/create endpoint      │ └────────┬────────────────────────┘          │         ▼ ┌─────────────────────────────────┐ │  Cloudflare KV Storage          │ │  garden-mcp-kv namespace        │ │  Session Data Persistence       │ └─────────────────────────────────┘`

## 1.2 Потік даних

1. **User Request** → Фронтенд відправляє POST запит до n8n webhook
    
2. **n8n Processing** → Workflow обробляє запит і викликає Cloudflare Worker
    
3. **Worker Logic** → Worker створює сесію в KV storage
    
4. **Response Chain** → Дані проходять через transform ноди і повертаються користувачу
    
5. **Session URL** → Генерується унікальний URL для MCP сесії
    

---

## <a name="cloudflare"></a>☁️ 2. CLOUDFLARE WORKER: ДЕТАЛЬНА КОНФІГУРАЦІЯ

## 2.1 Основна інформація

|Параметр|Значення|
|---|---|
|**Worker Name**|`garden-mcp-server`|
|**Production URL**|`https://garden-mcp-server.maxfraieho.workers.dev`|
|**Account**|vokov's Cloudflare Account|
|**Runtime**|Cloudflare Workers (V8 isolates)|
|**Status**|✅ Active & Deployed|

## 2.2 KV Namespace Configuration

**Namespace Details:**

- **Name**: `garden-mcp-kv`
    
- **Binding Variable**: `KV` (доступний в worker коді як `env.KV`)
    
- **Purpose**: Зберігання даних MCP сесій
    
- **TTL**: Configurable per key
    

**Binding Configuration:**

javascript

`// У Worker коді доступ через: await env.KV.put(key, value, { expirationTtl: 3600 }) await env.KV.get(key) await env.KV.delete(key)`

## 2.3 Environment Variables

## 2.3.1 SESSION_SECRET

text

`Name: SESSION_SECRET Type: Secret (encrypted) Value: mcp9K7xF2wQ8vB4nL6hT3yR5jM1pZ0sC Purpose: HMAC підпис для генерації session IDs Usage: Забезпечення криптографічної безпеки сесій`

**Використання в коді:**

typescript

`import { createHmac } from 'crypto'; const sessionId = createHmac('sha256', env.SESSION_SECRET)   .update(Date.now().toString())  .digest('hex')  .substring(0, 32);`

## 2.3.2 ENVIRONMENT

text

`Name: ENVIRONMENT Type: Plain Text Value: production Purpose: Runtime environment identifier Usage: Умовна логіка для prod/dev режимів`

## 2.4 Worker Code Structure (Рекомендована)

typescript

``export default {   async fetch(request: Request, env: Env): Promise<Response> {    const url = new URL(request.url);         // CORS headers    const corsHeaders = {      'Access-Control-Allow-Origin': '*',      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',      'Access-Control-Allow-Headers': 'Content-Type, Authorization',    };         // Health check endpoint    if (url.pathname === '/health') {      return new Response(JSON.stringify({        status: 'healthy',        environment: env.ENVIRONMENT,        timestamp: new Date().toISOString()      }), {        headers: { ...corsHeaders, 'Content-Type': 'application/json' }      });    }         // POST /sessions/create    if (url.pathname === '/sessions/create' && request.method === 'POST') {      try {        const body = await request.json();                 // Generate session ID        const sessionId = generateSessionId(env.SESSION_SECRET);                 // Store session data        await env.KV.put(          `session:${sessionId}`,          JSON.stringify({            ...body,            createdAt: Date.now(),            expiresAt: Date.now() + 3600000 // 1 hour          }),          { expirationTtl: 3600 }        );                 return new Response(JSON.stringify({          sessionId,          status: 'created'        }), {          headers: { ...corsHeaders, 'Content-Type': 'application/json' }        });      } catch (error) {        return new Response(JSON.stringify({          error: 'Invalid request'        }), {          status: 400,          headers: { ...corsHeaders, 'Content-Type': 'application/json' }        });      }    }         return new Response('Not Found', { status: 404 });  } }; function generateSessionId(secret: string): string {   const data = `${Date.now()}-${Math.random()}`;  return createHmac('sha256', secret)    .update(data)    .digest('hex')    .substring(0, 32); }``

## 2.5 Testing Endpoints

**Health Check:**

bash

`curl https://garden-mcp-server.maxfraieho.workers.dev/health`

**Expected Response:**

json

`{   "status": "healthy",  "environment": "production",  "timestamp": "2026-01-11T14:00:00.000Z" }`

---

## <a name="n8n-workflow"></a>🔄 3. N8N WORKFLOW: ПОКРОКОВА СТРУКТУРА

## 3.1 Workflow Overview[n8n.exodus.pp](https://n8n.exodus.pp.ua/workflow/zjAN3j6YO15oH8Tl)​

**Workflow Name**: MCP Session Manager  
**Workflow ID**: `zjAN3j6YO15oH8Tl`  
**Status**: Збережено і активовано  
**Total Nodes**: 5

## 3.2 Node-by-Node Configuration

## 📍 NODE 1: Webhook (Trigger)

**Type**: Trigger Node  
**Purpose**: Прийом HTTP запитів від фронтенду

**Configuration:**

text

`HTTP Method: POST Path: mcp-create Authentication: None Respond: When Last Node Finishes Response Data: First Entry JSON URLs:   Production: https://n8n.exodus.pp.ua/webhook/mcp-create  Test: https://n8n.exodus.pp.ua/webhook-test/mcp-create`

**Expected Input Schema:**

json

`{   "userId": "string",  "sessionType": "chat|tool|custom",  "metadata": {    "source": "web|mobile|api",    "version": "string"  } }`

**Рекомендації для фронтенду:**

typescript

`// Frontend API call const createSession = async (data: SessionRequest) => {   const response = await fetch('https://n8n.exodus.pp.ua/webhook/mcp-create', {    method: 'POST',    headers: {      'Content-Type': 'application/json',    },    body: JSON.stringify(data)  });     return await response.json(); };`

---

## 🌐 NODE 2: HTTP Request (Cloudflare Call)

**Type**: Action Node  
**Purpose**: Виклик Cloudflare Worker для створення сесії

**Configuration:**

text

`Method: POST URL: https://garden-mcp-server.maxfraieho.workers.dev/sessions/create Authentication: Generic Credential Type   Credential: Cloudflare MCP Worker  Type: Header Auth  Header: Authorization  Value: Bearer mcp9K7xF2wQ8vB4nL6hT3yR5jM1pZ0sC Body:   Content Type: JSON  Body: {{ $json }}  # Forwards webhook payload Options:   - Timeout: 30 seconds  - Response Format: JSON  - Redirect: Follow`

**Output Schema:**

json

`{   "sessionId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",  "status": "created" }`

**Error Handling:**

- **Network Error**: Retry з exponential backoff
    
- **401 Unauthorized**: Перевірити Authorization header
    
- **500 Server Error**: Log і повернути помилку клієнту
    

---

## ⚙️ NODE 3: Code in JavaScript (Transform)

**Type**: Function Node  
**Purpose**: Генерація URL для MCP сесії

**Configuration:**

text

``Mode: Run Once for Each Item Language: JavaScript Code:   return {    sessionUrl: `https://n8n.exodus.pp.ua/mcp-session/${$json.sessionId}`  }; Input: $json from HTTP Request node Output: { sessionUrl: string }``

**Пояснення логіки:**

javascript

`// Вхідні дані від HTTP Request: // { sessionId: "abc123...", status: "created" } // Вихідні дані після трансформації: // {  //   sessionUrl: "https://n8n.exodus.pp.ua/mcp-session/abc123..." // }`

**Альтернативна конфігурація (розширена):**

javascript

``const baseUrl = 'https://n8n.exodus.pp.ua/mcp-session'; const sessionId = $json.sessionId; const expiresAt = Date.now() + 3600000; // 1 hour return {   sessionUrl: `${baseUrl}/${sessionId}`,  expiresAt: expiresAt,  expiresAtISO: new Date(expiresAt).toISOString() };``

---

## 📝 NODE 4: Edit Fields (Format)

**Type**: Data Transformation Node  
**Purpose**: Структурування фінальної відповіді

**Configuration:**

text

`Mode: Manual Mapping Include Other Input Fields: false Fields to Set:   - Name: sessionId    Type: String    Value: {{ $('HTTP Request').item.json.sessionId }}       - Name: sessionUrl    Type: String    Value: {{ $('Code').item.json.sessionUrl }}`

**Data Flow:**

text

`Input (aggregated): ├─ HTTP Request output: { sessionId, status } └─ Code output: { sessionUrl } Output (formatted): {   "sessionId": "abc123...",  "sessionUrl": "https://n8n.exodus.pp.ua/mcp-session/abc123..." }`

**Додаткові поля (опціонально):**

text

`- Name: createdAt   Type: String  Value: {{ $now.toISO() }}   - Name: expiresIn   Type: Number  Value: 3600`

---

## 📤 NODE 5: Respond to Webhook (Response)

**Type**: Response Node  
**Purpose**: Відправка результату назад до клієнта

**Configuration:**

text

`Respond With: JSON Response Body: {{ $json }} Status Code: 200 (success) Headers:   Content-Type: application/json  X-Response-Time: {{ $now.toMillis() }}`

**Final Response Schema:**

json

`{   "sessionId": "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6",  "sessionUrl": "https://n8n.exodus.pp.ua/mcp-session/a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6" }`

**Error Response (у разі помилки):**

json

`{   "error": "Failed to create session",  "details": "Connection timeout to Cloudflare Worker",  "timestamp": "2026-01-11T14:00:00.000Z" }`

---

## 3.3 Workflow Execution Flow

text

`┌─────────────────────────────────────────────────────────────┐ │ 1. WEBHOOK TRIGGER                                          │ │    POST /webhook/mcp-create                                 │ │    Input: { userId, sessionType, metadata }                 │ └───────────────────────┬─────────────────────────────────────┘                         │                        ▼ ┌─────────────────────────────────────────────────────────────┐ │ 2. HTTP REQUEST                                             │ │    Call Cloudflare Worker                                   │ │    POST /sessions/create                                    │ │    Auth: Bearer mcp9K7xF2wQ8vB4nL6hT3yR5jM1pZ0sC           │ │    Output: { sessionId, status }                            │ └───────────────────────┬─────────`

1. [https://n8n.exodus.pp.ua/workflow/zjAN3j6YO15oH8Tl](https://n8n.exodus.pp.ua/workflow/zjAN3j6YO15oH8Tl)