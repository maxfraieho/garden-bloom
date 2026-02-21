---
{"title":"Backend Setup Guide for New Lovable Account","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Backend Setup Guide for New Lovable Account/","dgPassFrontmatter":true,"noteIcon":""}
---


> Повний список змінних, секретів та конфігурацій для налаштування бекенду Дата: 2026-02-08

---

## 1) Lovable Settings (Frontend ENV)

В налаштуваннях Lovable проєкту (Settings → Environment Variables):

|Variable|Value|Опис|
|---|---|---|
|`VITE_MCP_GATEWAY_URL`|`https://garden-mcp.exodus.pp.ua`|URL Cloudflare Worker gateway|

**Fallback URL:** `https://garden-mcp-server.maxfraieho.workers.dev`

---

## 2) Cloudflare Worker Secrets

Додати через Cloudflare Dashboard (Workers → garden-mcp-server → Settings → Variables):

### Обов'язкові секрети

|Secret|Value|Опис|
|---|---|---|
|`JWT_SECRET`|`[generate-new-32-char-secret]`|Секрет для підпису JWT токенів Owner Auth|
|`MINIO_ENDPOINT`|`https://apiminio.exodus.pp.ua`|URL MinIO/S3 API|
|`MINIO_BUCKET`|`mcpstorage`|Назва bucket для storage|
|`MINIO_ACCESS_KEY`|`[your-minio-access-key]`|MinIO access key|
|`MINIO_SECRET_KEY`|`[your-minio-secret-key]`|MinIO secret key|
|`NOTEBOOKLM_BASE_URL`|`https://notebooklm-gateway-1.replit.app`|URL Replit backend|
|`NOTEBOOKLM_SERVICE_TOKEN`|`garden-nlm-service-2026-a7f3b9c1e5d2`|Bearer token для Replit|
|`NOTEBOOKLM_TIMEOUT_MS`|`90000`|Таймаут для NotebookLM (90 сек)|
|`REPLIT_BACKEND_URL`|`https://notebooklm-gateway-1.replit.app`|URL Replit для Git ops|
|`REPLIT_SERVICE_TOKEN`|`garden-nlm-service-2026-a7f3b9c1e5d2`|Token для Git automation|

### KV Namespace Binding

|Binding|Namespace|Опис|
|---|---|---|
|`KV`|`MCP_SESSIONS`|KV для сесій, зон, owner auth|

**Створення KV:**

```shell
wrangler kv:namespace create "MCP_SESSIONS"
# Скопіювати ID у wrangler.toml
```

---

## 3) Replit Backend Configuration

### Environment Variables (Replit Secrets)

|Variable|Value|Опис|
|---|---|---|
|`SERVICE_TOKEN`|`garden-nlm-service-2026-a7f3b9c1e5d2`|Для авторизації запитів від Worker|
|`DATABASE_URL`|`postgresql://...`|PostgreSQL connection string|
|`GITHUB_PAT`|`ghp_...`|GitHub Classic PAT для Git automation|
|`GITHUB_REPO`|`maxfraieho/project-genesis`|Target repository|
|`GITHUB_BRANCH`|`main`|Target branch|
|`MINIO_ENDPOINT`|`https://apiminio.exodus.pp.ua`|MinIO URL|
|`MINIO_ACCESS_KEY`|`[your-minio-access-key]`|MinIO access key|
|`MINIO_SECRET_KEY`|`[your-minio-secret-key]`|MinIO secret key|
|`MINIO_BUCKET`|`mcpstorage`|MinIO bucket|

### GitHub PAT Permissions (Classic Token)

Для Git automation потрібен Classic PAT з правами:

- `repo` (Full control of private repositories)
- `workflow` (якщо потрібно тригерити Actions)

---

## 4) CORS Configuration

У Cloudflare Worker потрібно дозволити нові домени:

```js
const ALLOWED_ORIGINS = [
  'https://lovable.dev',
  'https://garden-path-diagnostics.lovable.app',  // published
  'https://id-preview--YOUR-NEW-PROJECT-ID.lovable.app', // preview
  'https://garden.exodus.pp.ua', // custom domain (якщо є)
  'http://localhost:5173', // local dev
  'http://localhost:8788', // wrangler dev
];
```

**Після створення нового проєкту:** додати нові preview/published URLs до allowlist.

---

## 5) Replit Backend Prompt

Скопіюй цей промт для налаштування Replit backend:

```
Це FastAPI бекенд для Digital Garden проєкту.

Основні endpoints:
1. /health - health check
2. /v1/chat - NotebookLM chat proxy (Playwright automation)
3. /v1/git/commit - commit файлів до GitHub
4. /v1/git/delete - видалення файлів з GitHub
5. /v1/git/status - перевірка існування файлу
6. /v1/drakon/commit - commit DRAKON діаграм
7. /v1/drakon/{folderSlug}/{diagramId} - CRUD для діаграм

Авторизація:
- Bearer token: garden-nlm-service-2026-a7f3b9c1e5d2
- Всі endpoints потребують Authorization header

GitHub Integration:
- Repository: maxfraieho/project-genesis
- Branch: main
- Path для нотаток: src/site/notes/
- Path для DRAKON: src/site/notes/{folder}/diagrams/

Таймаути:
- NotebookLM Playwright: до 120 сек
- Git operations: 30 сек
```

---

## 6) API Endpoints Reference

### Cloudflare Worker (Gateway)

|Endpoint|Method|Auth|Опис|
|---|---|---|---|
|`/health`|GET|-|Health check|
|`/auth/status`|POST|-|Check owner initialization|
|`/auth/setup`|POST|-|First-time password setup|
|`/auth/login`|POST|-|Owner login → JWT|
|`/auth/validate`|POST|Bearer|Validate JWT|
|`/auth/refresh`|POST|Bearer|Refresh JWT|
|`/zones/create`|POST|Bearer|Create access zone|
|`/zones/list`|GET|Bearer|List all zones|
|`/zones/validate/:id`|GET|-|Validate zone access|
|`/zones/:id/notes`|GET|X-Zone-Code|Get zone notes|
|`/notebooklm/chat`|POST|Bearer|NotebookLM chat|
|`/v1/drakon/commit`|POST|Bearer|Save DRAKON diagram|
|`/v1/drakon/:folder/:id`|DELETE|Bearer|Delete DRAKON diagram|

### Replit Backend

|Endpoint|Method|Auth|Опис|
|---|---|---|---|
|`/health`|GET|-|Health check|
|`/v1/chat`|POST|Bearer|NotebookLM Playwright chat|
|`/v1/git/commit`|POST|Bearer|Commit to GitHub|
|`/v1/git/delete`|POST|Bearer|Delete from GitHub|
|`/v1/git/status`|GET|Bearer|Check file existence|

---

## 7) Verification Checklist

Після налаштування перевірити:

1. **Gateway Health:**
    
    ```shell
    curl https://garden-mcp.exodus.pp.ua/health
    ```
    
2. **Auth Status:**
    
    ```shell
    curl -X POST https://garden-mcp.exodus.pp.ua/auth/status
    ```
    
3. **Replit Health:**
    
    ```shell
    curl https://notebooklm-gateway-1.replit.app/health
    ```
    
4. **Frontend Diagnostics:**
    
    - Відкрити `/admin/diagnostics` у preview
    - Всі checks мають бути зеленими
5. **DRAKON Editor:**
    
    - Відкрити `/drakon?id=test&new=true`
    - Створити тестову діаграму
    - Зберегти — має з'явитись commit у GitHub

---

## 8) Troubleshooting

### CORS Error

→ Додати preview/published URL до ALLOWED_ORIGINS у Worker

### 401 Unauthorized (NotebookLM)

→ Перевірити NOTEBOOKLM_SERVICE_TOKEN у Worker та SERVICE_TOKEN у Replit

### JWT Invalid

→ Перевірити JWT_SECRET у Worker (має бути однаковий для sign/verify)

### MinIO Access Denied

→ Перевірити MINIO_ACCESS_KEY та MINIO_SECRET_KEY у Worker та Replit

### Git Commit Failed

→ Перевірити GITHUB_PAT у Replit (права repo)

---

## 9) Security Reminders

⚠️ **НІКОЛИ не комітити секрети в код!**

- JWT_SECRET — генерувати унікальний для кожного environment
- GITHUB_PAT — використовувати Classic PAT з мінімальними правами
- SERVICE_TOKEN — можна залишити той самий для continuity

**Ротація секретів:**

1. Генерувати новий секрет
2. Оновити в Cloudflare/Replit
3. Invalidate old sessions (видалити `owner:*` ключі з KV)