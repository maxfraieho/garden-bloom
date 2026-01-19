---
{"title":"MCP Access UI - Service Description","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Сервіси/MCP/Конфігурації/MCP Access UI - Service Description/","dgPassFrontmatter":true,"noteIcon":""}
---



# 🔗 MCP Access UI Service - Повний Опис

> **Дата створення**: 11 січня 2026  
> **Версія**: 1.0  
> **Статус**: 🔴 Помилка CORS під час створення сесій

---

## 📌 ПРИЗНАЧЕННЯ СЕРВІСУ

MCP Access UI — це фронтенд-компонент для створення тимчасових MCP (Model Context Protocol) endpoints, які дозволяють зовнішнім AI-агентам (Claude Desktop, CLI, API) отримати доступ до вибраних папок Digital Garden.

### Основні функції:
1. **Вибір папок** — користувач обирає папки для експорту
2. **Налаштування TTL** — час життя сесії (5-1440 хвилин)
3. **Створення сесії** — виклик n8n webhook → Cloudflare Worker → KV Storage
4. **Управління сесіями** — перегляд активних, копіювання URL, видалення
5. **Інструкції підключення** — для Claude Desktop/CLI

---

## 🏗️ АРХІТЕКТУРА

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Lovable/React)                     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐   ┌────────────────────┐   ┌───────────────┐  │
│  │ MCPAccessPanel   │   │ useMCPSessions     │   │ ActiveSession │  │
│  │ - TTL selection  │──▶│ - createSession()  │──▶│ Card          │  │
│  │ - Folder display │   │ - revokeSession()  │   │ - Copy URL    │  │
│  │ - Create button  │   │ - localStorage     │   │ - Delete      │  │
│  └──────────────────┘   └────────────────────┘   └───────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼ HTTP POST (CORS!)
┌─────────────────────────────────────────────────────────────────────┐
│                           N8N WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────┤
│  Webhook: https://n8n.exodus.pp.ua/webhook/mcp-create               │
│                                                                      │
│  ┌─────────┐   ┌───────────┐   ┌──────────┐   ┌──────────────────┐  │
│  │ Webhook │──▶│ Check if  │──▶│ OPTIONS? │──▶│ Respond 204      │  │
│  │ Trigger │   │ OPTIONS   │   │   Yes    │   │ + CORS headers   │  │
│  └─────────┘   └───────────┘   └──────────┘   └──────────────────┘  │
│                      │                                               │
│                      ▼ No (POST)                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │ HTTP Request → Cloudflare Worker                               │ │
│  │ POST https://garden-mcp-server.maxfraieho.workers.dev/sessions │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                      │                                               │
│                      ▼                                               │
│  ┌─────────┐   ┌───────────┐   ┌──────────────────────────────────┐ │
│  │ Code    │──▶│ Edit      │──▶│ Respond to Webhook               │ │
│  │ (URL)   │   │ Fields    │   │ { sessionId, sessionUrl }        │ │
│  └─────────┘   └───────────┘   │ + CORS headers                   │ │
│                                 └──────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE WORKER                               │
├─────────────────────────────────────────────────────────────────────┤
│  URL: https://garden-mcp-server.maxfraieho.workers.dev              │
│                                                                      │
│  Endpoints:                                                          │
│  - POST /sessions/create  - Створення нової сесії                   │
│  - GET  /sessions/:id     - Отримання деталей сесії                 │
│  - DELETE /sessions/:id   - Видалення сесії                         │
│  - GET  /health           - Health check                             │
│                                                                      │
│  Storage: Cloudflare KV (garden-mcp-kv)                             │
│  Auth: Bearer token (SESSION_SECRET)                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📂 ФАЙЛОВА СТРУКТУРА

### Frontend Components

| Файл | Призначення |
|------|-------------|
| `src/hooks/useMCPSessions.ts` | Головний хук для управління сесіями |
| `src/components/garden/MCPAccessPanel.tsx` | UI панель створення доступу |
| `src/components/garden/MCPEndpointList.tsx` | Список активних сесій |
| `src/components/garden/ActiveSessionCard.tsx` | Картка окремої сесії |
| `src/components/garden/ConnectionInstructions.tsx` | Інструкції підключення |

### Environment Variables

```bash
# Lovable .env (secrets)
VITE_N8N_MCP_CREATE_WEBHOOK=https://n8n.exodus.pp.ua/webhook/mcp-create
VITE_N8N_MCP_REVOKE_WEBHOOK=https://n8n.exodus.pp.ua/webhook/mcp-revoke
VITE_CLOUDFLARE_WORKER_URL=https://garden-mcp-server.maxfraieho.workers.dev
```

---

## 🔴 ПРОБЛЕМА: CORS ERROR

### Симптоми

```
CORS/Network error: Unable to reach https://n8n.exodus.pp.ua/webhook/mcp-create. 
Check if n8n webhook handles OPTIONS preflight.
```

### Що відбувається

1. **Browser** відправляє `OPTIONS` preflight request перед `POST`
2. **n8n webhook** не повертає правильні CORS headers
3. **Browser** блокує `POST` запит
4. **Frontend** показує помилку "Failed to fetch"

### Діагностичні логи в консолі

```javascript
[MCP] Attempting POST to: https://n8n.exodus.pp.ua/webhook/mcp-create
[MCP] Payload: { folders: [...], ttlMinutes: 60, ... }
[MCP] Strategy 1: Standard JSON POST with Content-Type: application/json
[MCP] Strategy 1 failed (likely CORS preflight rejected): TypeError: Failed to fetch
[MCP] Strategy 2: POST without Content-Type header
[MCP] Strategy 2 failed: TypeError: Failed to fetch
[MCP] Strategy 3: POST with Content-Type: text/plain
[MCP] All strategies failed: TypeError: Failed to fetch
```

---

## 🛠️ MITIGATION STRATEGIES (РЕАЛІЗОВАНО)

### `postJsonWithCorsFallback()` функція

```typescript
async function postJsonWithCorsFallback(url: string, payload: unknown): Promise<Response> {
  const body = JSON.stringify(payload);

  // Strategy 1: Standard JSON request (triggers preflight)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    return response;
  } catch (error) { /* CORS preflight failed */ }

  // Strategy 2: POST without Content-Type header (simple request)
  try {
    const response = await fetch(url, {
      method: 'POST',
      body,
    });
    return response;
  } catch (error) { /* Still failed */ }

  // Strategy 3: Use text/plain (simple request for some servers)
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body,
    });
    return response;
  } catch (error) {
    throw new Error(`CORS/Network error: Unable to reach ${url}`);
  }
}
```

---

## ✅ ВИМОГИ ДО N8N WORKFLOW

### OPTIONS Preflight Handler

```json
{
  "nodes": [
    {
      "name": "Webhook",
      "parameters": {
        "httpMethod": "=",  // Accept ALL methods including OPTIONS
        "path": "mcp-create"
      }
    },
    {
      "name": "Check if OPTIONS",
      "type": "n8n-nodes-base.if",
      "parameters": {
        "conditions": {
          "string": [{
            "value1": "={{ $request.method }}",
            "operation": "equals",
            "value2": "OPTIONS"
          }]
        }
      }
    },
    {
      "name": "Respond OPTIONS",
      "type": "n8n-nodes-base.respondToWebhook",
      "parameters": {
        "responseCode": "=204",
        "options": {
          "responseHeaders": {
            "entries": [
              { "name": "Access-Control-Allow-Origin", "value": "*" },
              { "name": "Access-Control-Allow-Methods", "value": "GET, POST, OPTIONS" },
              { "name": "Access-Control-Allow-Headers", "value": "Content-Type, Authorization" },
              { "name": "Access-Control-Max-Age", "value": "86400" }
            ]
          }
        }
      }
    }
  ]
}
```

---

## 🧪 ТЕСТУВАННЯ

### cURL тест OPTIONS

```bash
curl -X OPTIONS https://n8n.exodus.pp.ua/webhook/mcp-create \
  -H "Origin: https://exodus.pp.ua" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# ОЧІКУВАНИЙ РЕЗУЛЬТАТ:
# HTTP/2 204
# access-control-allow-origin: *
# access-control-allow-methods: GET, POST, OPTIONS
# access-control-allow-headers: Content-Type, Authorization
```

### cURL тест POST

```bash
curl -X POST https://n8n.exodus.pp.ua/webhook/mcp-create \
  -H "Content-Type: application/json" \
  -H "Origin: https://exodus.pp.ua" \
  -d '{
    "folders": ["exodus.pp.ua/Test"],
    "ttlMinutes": 60,
    "userId": "test-user"
  }' \
  -v

# ОЧІКУВАНИЙ РЕЗУЛЬТАТ:
# HTTP/2 200
# access-control-allow-origin: *
# { "sessionId": "abc123...", "sessionUrl": "https://..." }
```

---

## 📊 DATA FLOW

```
┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌───────────┐
│   Browser    │────▶│   n8n       │────▶│  Cloudflare  │────▶│    KV     │
│ (Lovable UI) │◀────│  Webhook    │◀────│   Worker     │◀────│  Storage  │
└──────────────┘     └─────────────┘     └──────────────┘     └───────────┘
       │                    │                    │                   │
       │ 1. POST /webhook/mcp-create            │                   │
       │    { folders, ttl, userId }            │                   │
       │                    │                    │                   │
       │ 2. (If OPTIONS) Return 204 + CORS      │                   │
       │                    │                    │                   │
       │                    │ 3. POST /sessions/create              │
       │                    │    + Bearer token                     │
       │                    │                    │                   │
       │                    │                    │ 4. KV.put(session)│
       │                    │                    │◀──────────────────│
       │                    │                    │                   │
       │                    │ 5. { sessionId }   │                   │
       │                    │◀───────────────────│                   │
       │                    │                    │                   │
       │ 6. { sessionId, sessionUrl }           │                   │
       │◀───────────────────│                    │                   │
       │                    │                    │                   │
```

---

## 🔗 ПОСИЛАННЯ

- **n8n Workflow**: https://n8n.exodus.pp.ua/workflow/31h1PqQrLmVqhSYA
- **Cloudflare Worker**: https://garden-mcp-server.maxfraieho.workers.dev
- **Health Check**: https://garden-mcp-server.maxfraieho.workers.dev/health

---

## 📝 HISTORY

| Дата | Подія |
|------|-------|
| 2026-01-11 | Створено n8n workflow "MCP Session Manager (with CORS)" |
| 2026-01-11 | Оновлено webhook для прийому OPTIONS |
| 2026-01-11 | Додано `postJsonWithCorsFallback()` fallback strategies |
| 2026-01-11 | CORS помилка все ще присутня — потребує дослідження |
