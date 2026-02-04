# Garden MCP Cloudflare Worker

## Призначення

Цей worker забезпечує:
- Аутентифікацію власника (Owner Auth)
- Управління MCP сесіями
- Управління Access Zones
- MCP JSON-RPC endpoint
- SSE транспорт для real-time комунікації

## Деплоймент

### Метод 1: GitHub Actions (рекомендований)

Автоматичний деплой при push до `main` гілки (якщо змінилися файли воркера).

**GitHub Actions workflow:** `.github/workflows/deploy-worker.yml`

#### Підготовка (один раз)

**1. Cloudflare API Token:**
- [Cloudflare Dashboard](https://dash.cloudflare.com) → My Profile → API Tokens
- Create Token → Use template "Edit Cloudflare Workers"
- Або custom token з правами: `Workers:Edit`, `Account:Read`

**2. GitHub Secrets:**
- Repository → Settings → Secrets and variables → Actions
- Додати `CLOUDFLARE_API_TOKEN` (обов'язково)
- Додати `CLOUDFLARE_ACCOUNT_ID` (опційно, якщо wrangler не визначає автоматично)

**3. KV Namespace ID:**
- Cloudflare Dashboard → Workers & Pages → KV → Create namespace
- Скопіювати ID namespace
- Вставити в `wrangler.toml` замість `REPLACE_WITH_YOUR_KV_NAMESPACE_ID`

#### Runtime налаштування в Cloudflare (НЕ в GitHub Actions)

Перед першим деплоєм в Cloudflare Worker мають бути налаштовані:

**Secrets (обов'язково):**
- [ ] `JWT_SECRET` - секрет для JWT токенів
- [ ] `MINIO_ENDPOINT` - URL MinIO API
- [ ] `MINIO_BUCKET` - назва bucket
- [ ] `MINIO_ACCESS_KEY` - access key MinIO
- [ ] `MINIO_SECRET_KEY` - secret key MinIO

**Secrets (опційно):**
- [ ] `NOTEBOOKLM_BASE_URL` - URL NotebookLM backend
- [ ] `NOTEBOOKLM_SERVICE_TOKEN` - токен авторизації
- [ ] `NOTEBOOKLM_TIMEOUT_MS` - таймаут (default: 15000)

**KV Binding:**
- [ ] Namespace `MCP_SESSIONS` прив'язаний як `KV`

Налаштувати секрети через Cloudflare Dashboard або CLI:
```bash
wrangler secret put JWT_SECRET
wrangler secret put MINIO_ACCESS_KEY
wrangler secret put MINIO_SECRET_KEY
# ...
```

#### Перевірка деплою

1. Push зміни до `main` гілки
2. GitHub → Actions → "Deploy Cloudflare Worker"
3. Перевірити статус workflow

**Типові проблеми:**
- `Authentication error` → перевірити `CLOUDFLARE_API_TOKEN`
- `Could not find wrangler.toml` → перевірити шлях `workingDirectory`
- `KV namespace not found` → перевірити ID в `wrangler.toml`

### Метод 2: Cloudflare Dashboard (Quick Edit)

**НЕ рекомендується для production** — використовуйте тільки для швидких тестів.

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
