# Garden MCP Cloudflare Worker

## Призначення

Цей worker забезпечує:
- Аутентифікацію власника (Owner Auth)
- Управління MCP сесіями
- Управління Access Zones
- MCP JSON-RPC endpoint
- SSE транспорт для real-time комунікації

## Деплоймент

**Метод:** Cloudflare Dashboard (Quick Edit)

**НЕ використовується:** Wrangler CLI

### Кроки деплою

1. Відкрити [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Workers & Pages → `garden-mcp-server`
3. Quick Edit
4. Вставити код з `index.js`
5. Save and Deploy

## Environment Variables

| Variable | Опис |
|----------|------|
| `JWT_SECRET` | Секрет для підпису JWT токенів |
| `MINIO_ENDPOINT` | URL MinIO API (e.g. `https://apiminio.exodus.pp.ua`) |
| `MINIO_BUCKET` | Назва bucket (e.g. `mcpstorage`) |
| `MINIO_ACCESS_KEY` | Access key MinIO |
| `MINIO_SECRET_KEY` | Secret key MinIO |

## KV Bindings

| Binding Name | Namespace |
|--------------|-----------|
| `KV` | `MCP_SESSIONS` |

## Endpoints

### Public
- `GET /health` - Health check
- `POST /auth/status` - Check owner initialization
- `POST /auth/setup` - One-time password setup
- `POST /auth/login` - Owner login → JWT
- `POST /auth/refresh` - Refresh JWT
- `POST /auth/validate` - Validate JWT

### Owner-Protected (JWT required)
- `POST /sessions/create` - Create MCP session
- `POST /sessions/revoke` - Delete session
- `GET /sessions/list` - List sessions

### Zones
- `POST /zones/create` - Create access zone
- `DELETE /zones/:zoneId` - Delete zone
- `GET /zones/list` - List zones
- `GET /zones/validate/:zoneId` - Validate zone access
- `GET /zones/:zoneId/notes` - Get zone notes

### MCP
- `POST /mcp?session=<id>` - MCP JSON-RPC
- `GET /sse?session=<id>` - SSE transport

## Пов'язані документи

- [AccessZone Logic](./accessZone.md)
- [Auth Model](./auth.md)
- [Comet Deploy Guide](../../../agents/comet/deploy.md)
