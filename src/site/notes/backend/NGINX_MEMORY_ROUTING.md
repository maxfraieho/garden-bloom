# Nginx Routing for Memory Backend

> **Статус:** Operational Guide
> **Оновлено:** 2026-03-08

Цей документ описує конфігурацію Nginx для маршрутизації трафіку від Cloudflare Worker Gateway до відповідних бекенд-сервісів (Memory API та NotebookLM).

## 1. Архітектура маршрутизації

```
Cloudflare Worker (Gateway)
  │
  │ (всі запити /v1/memory/* та інші бекенд-запити)
  ▼
https://notebooklm.exodus.pp.ua (Nginx)
  │
  ├─ /v1/memory/* ───────► Memory API (Port 3001)
  └─ / ──────────────────► NotebookLM API (Port 5000)
```

## 2. Nginx Конфігурація

У файлі `nginx.conf` сервера потрібно налаштувати наступне:

```nginx
server {
    listen 443 ssl;
    server_name notebooklm.exodus.pp.ua;

    # SSL configuration
    ssl_certificate /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/privkey.pem;

    # CORS Headers (якщо не обробляються на рівні Worker)
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS, PUT, DELETE, PATCH";
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Correlation-Id";

    # Memory API Backend (DiffMem / Mastra)
    location /v1/memory/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Таймуати для LLM-запитів
        proxy_read_timeout 120s;
        proxy_connect_timeout 60s;
    }

    # NotebookLM Backend (Python/FastAPI)
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## 3. Cloudflare Tunnel альтернатива

Якщо використовується Cloudflare Tunnel (cloudflared) замість прямого відкритого порту + Nginx:

```yaml
# config.yml
tunnel: <tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: notebooklm.exodus.pp.ua
    path: /v1/memory/*
    service: http://localhost:3001
  - hostname: notebooklm.exodus.pp.ua
    service: http://localhost:5000
  - service: http_status:404
```

## 4. Перевірка маршрутизації

```bash
# Тест Memory API
curl -H "Authorization: Bearer $SERVICE_TOKEN" https://notebooklm.exodus.pp.ua/v1/memory/health

# Тест NotebookLM
curl -H "Authorization: Bearer $SERVICE_TOKEN" https://notebooklm.exodus.pp.ua/health
```