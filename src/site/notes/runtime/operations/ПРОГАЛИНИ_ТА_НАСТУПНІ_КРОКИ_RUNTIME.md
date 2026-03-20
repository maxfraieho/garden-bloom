---
tags:
  - domain:runtime
  - status:canonical
  - layer:operations
  - authority:production
created: 2026-02-25
updated: 2026-02-27
legacy_name: "ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME.md"
changelog:
  - 2026-02-28 (rev 5): Додано GAP-8 (key auto-sync) — ВИРІШЕНО. Додано GAP-9 (signal decoding) — ВИРІШЕНО. Оновлено multi-node scaling пріоритет.
  - 2026-02-27 (rev 4): Protocol V1 E2E підтверджений. Видалено "Пріоритет 1 — Реєстрація Worker" — виконано. Оновлено наступні кроки: post-V1 roadmap (WebSocket, dashboard, multi-node).
  - 2026-02-25 (rev 3): GAP-7 позначено RESOLVED. Документ переписано українською. Оновлено матрицю.
  - 2026-02-25 (rev 2): GAP-1 and GAP-2 marked RESOLVED (Replit commit 150b491). GAP-7 added.
title: "Прогалини та наступні кроки Runtime"
dg-publish: true
---

# BLOOM Runtime — Прогалини та наступні кроки

> Створено: 2026-02-25
> Оновлено: 2026-02-27
> Статус: Canonical
> Layer: Runtime Operations
> Authority: Production Environment
> Scope: Відомі прогалини розгортання та пріоритизований план усунення

---

## Контекст

Цей документ фіксує дельту між **поточним розгорнутим станом** та **production-ready станом** BLOOM Runtime.

**Поточний стан (2026-02-27):** Protocol V1 E2E підтверджений. Всі GAP-1..GAP-7 вирішені. Workers зареєстровані та online. Перший повний pipeline: create → dispatch → heartbeat → complete → artifact — виконано успішно.

Базовий стан: [[СТАН_РОЗГОРТАННЯ_RUNTIME_ALPINE.md]]

---

## Критичні прогалини

### GAP-1: Відсутність персистентного сховища — ✅ ВИРІШЕНО (2026-02-25)

**Вирішено у:** Lovable commit `150b491`

**Опис рішення:**
- Клас `DatabaseStorage` у `server/storage.ts` (Drizzle ORM + PostgreSQL)
- Замінює `MemStorage` — той самий інтерфейс `IStorage`
- Всі сутності персистовані: tasks, leases, artifacts, results, audit, config

**Деталі:** [[СТАН_РЕАЛІЗАЦІЇ_BACKEND_RUNTIME.md]]

---

### GAP-2: Відсутність аутентифікації Runtime API — ✅ ВИРІШЕНО (2026-02-25)

**Вирішено у:** Lovable commit `150b491`

**Опис рішення:**
- `server/middleware/runtimeAuth.ts` — заголовок `X-Runtime-API-Key`, timing-safe порівняння
- Застосовано до всіх `/api/runtime/*` маршрутів
- Ключ з env var `RUNTIME_API_KEY`; якщо не встановлено — auth вимкнено (dev mode)
- Незахищені маршрути: `/api/runtime/health`, `/api/runtime/test-connection`

---

### GAP-3: Rate Limiting не налаштований — ✅ ВИРІШЕНО (2026-02-25)

**Вирішено у:** Lovable implementation

**Опис рішення:**
- `express-rate-limit` middleware додано до `server/routes.ts`
- Загальний ліміт: 100 req/хв на `/api/runtime/*` і `/api/membridge/*`
- Суворий ліміт: 20 req/хв на `POST /api/runtime/test-connection`
- Стандартні `RateLimit-*` заголовки у відповідях
- JSON повідомлення при перевищенні ліміту

---

### GAP-4: Workers не зареєстровані — ✅ ВИРІШЕНО (2026-02-27)

**Вирішено у:** Lovable + Alpine операційний (worker "alpine" активний)

**Опис рішення:**
- Додано `POST /api/runtime/workers` — пряма реєстрація worker через Runtime API
- Worker "alpine" (node-agent) зареєстрований у Membridge та bloom-runtime
- Auto-sync з Membridge `/agents` (кожні 10с) тримає `status: "online"`
- `workerSync.ts`: агенти з membridge-списку → `status: "online"` (fix 2026-02-27)

**Поточний стан:**
```http
GET /api/runtime/workers
→ [{"id":"alpine","status":"online","capabilities":{"claude_cli":true,"max_concurrency":2}}]
```

---

### GAP-5: Відсутність TLS / HTTPS — ✅ ВИРІШЕНО (2026-02-27)

**Вирішено у:** Cloudflare Tunnel (cloudflared)

**Опис рішення:**
- `cloudflared` tunnel → `bloom.exodus.pp.ua` → `localhost:5000`
- TLS терміновано на Cloudflare edge; локально трафік залишається HTTP (loopback)
- HTTPS redirect middleware активний у `NODE_ENV=production` (`X-Forwarded-Proto`)

---

### GAP-6: Артефакти підключені до MinIO — ✅ ВИРІШЕНО (2026-02-25)

**Вирішено у:** Lovable implementation

**Опис рішення:**
- `server/runtime/minioArtifacts.ts` — MinIO клієнт для артефактів
- При `POST .../complete`: якщо MinIO налаштований → upload content до `bloom-artifacts` bucket → зберігає `minio://` URL в `artifact.url`, content=null
- Якщо MinIO не налаштований → graceful fallback на PostgreSQL (content зберігається в таблиці)
- Автоматичне створення bucket якщо не існує

**Env vars для MinIO артефактів:**
- `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
- `MINIO_ARTIFACT_BUCKET` (default: `bloom-artifacts`)

---

### GAP-7: Membridge Control Plane UI не інтегрований — ✅ ВИРІШЕНО (2026-02-25)

**Вирішено у:** Lovable implementation

**Опис рішення:**
1. Proxy-маршрути `/api/membridge/*` у `server/routes.ts` через `membridgeFetch()`
2. `MembridgePage.tsx` — список проєктів, лідерство, ноди, промоція primary
3. Навігаційна панель у `App.tsx` з вкладками Runtime / Membridge / Nodes
4. Admin key інжектується бекендом — фронтенд ніколи не бачить ключ
5. Audit log для операцій промоції

**Деталі:** [[ІНТЕГРАЦІЯ_UI_REPLIT_MEMBRIDGE.md]]

---

## Зведена матриця прогалин

| Прогалина | ID | Серйозність | Статус | Вирішено |
|-----------|----|-------------|--------|---------|
| Persistence layer | GAP-1 | Критична | ✅ **ВИРІШЕНО** | 2026-02-25 |
| API auth | GAP-2 | Критична | ✅ **ВИРІШЕНО** | 2026-02-25 |
| Rate limiting | GAP-3 | Висока | ✅ **ВИРІШЕНО** | 2026-02-25 |
| Workers не зареєстровані | GAP-4 | Висока | ✅ **ВИРІШЕНО** | 2026-02-27 |
| Відсутність TLS | GAP-5 | Середня | ✅ **ВИРІШЕНО** | 2026-02-27 (Cloudflare) |
| Артефакти не в MinIO | GAP-6 | Середня | ✅ **ВИРІШЕНО** | 2026-02-25 |
| Membridge UI не інтегр. | GAP-7 | Середня | ✅ **ВИРІШЕНО** | 2026-02-25 |

**Всі GAP-1..GAP-9 вирішені. Protocol V1 E2E підтверджений 2026-02-27.**

---

### GAP-8: Auto-sync ключів між Runtime і агентами — ✅ ВИРІШЕНО (2026-02-28)

**Вирішено у:** commit `ed18ac2`

**Опис рішення:**
- Runtime повертає `membridge_agent_key` + `membridge_admin_key` при реєстрації агента
- Агент автоматично оновлює `.env.agent` при розбіжності ключів
- Усуває необхідність ручного копіювання ключів на кожну ноду

---

### GAP-9: Signal decoding у exit codes — ✅ ВИРІШЕНО (2026-02-28)

**Вирішено у:** agent/main.py

**Опис рішення:**
- Exit codes ≥ 128 декодуються у human-readable signal names (137 → SIGKILL, 143 → SIGTERM)
- Допомагає діагностувати OOM та timeout проблеми на edge-нодах
- Інформація включена у task failure detail

---

## Зведена матриця прогалин (оновлена)

| Прогалина | ID | Статус | Вирішено |
|-----------|----|--------|---------|
| Persistence layer | GAP-1 | ✅ | 2026-02-25 |
| API auth | GAP-2 | ✅ | 2026-02-25 |
| Rate limiting | GAP-3 | ✅ | 2026-02-25 |
| Workers не зареєстровані | GAP-4 | ✅ | 2026-02-27 |
| Відсутність TLS | GAP-5 | ✅ | 2026-02-27 |
| Артефакти не в MinIO | GAP-6 | ✅ | 2026-02-25 |
| Membridge UI не інтегр. | GAP-7 | ✅ | 2026-02-25 |
| Key auto-sync | GAP-8 | ✅ | 2026-02-28 |
| Signal decoding | GAP-9 | ✅ | 2026-02-28 |

---

## Рекомендовані наступні кроки (post-V1 roadmap)

### ~~Пріоритет 1 — Persistence Layer~~ ✅ Виконано (2026-02-25)

### ~~Пріоритет 2 — Auth Hardening~~ ✅ Виконано (2026-02-25)

### ~~Пріоритет 3 — Інтеграція UI Membridge~~ ✅ Виконано (2026-02-25)

### ~~Пріоритет 4 — Реєстрація Worker + Protocol V1~~ ✅ Виконано (2026-02-27)

Worker "alpine" online. E2E pipeline підтверджений: create → dispatch → heartbeat → complete → artifact.

---

### Пріоритет 1 — WebSocket real-time notifications

**Розблоковує:** Live UI оновлення без polling; відображення статусу задачі в реальному часі

**Опис:**
- `ws` або `socket.io` ендпоінт у bloom-runtime
- Push-події: `task.status_changed`, `worker.online`, `lease.expired`
- Фронтенд підписується замість 5-секундного polling у `RuntimeSettingsPage`

---

### Пріоритет 2 — Dashboard метрики

**Розблоковує:** Спостережуваність production; моніторинг throughput

**Опис:**
- Prometheus-сумісний `/metrics` ендпоінт
- Метрики: `bloom_tasks_total{status}`, `bloom_workers_online`, `bloom_lease_duration_seconds`
- Ротація логів: `/etc/logrotate.d/bloom-runtime`
- Опційно: Grafana dashboard для bloom-runtime

---

### Пріоритет 3 — Multi-node scaling

**Розблоковує:** Горизонтальне масштабування; відмовостійкість

**Опис:**
- Розгортання node-agent на додаткових машинах (ARM64, x86_64)
- Кожен агент реєструється в membridge + bloom-runtime при старті
- `pickWorker()` sticky routing по `context_id` вже реалізований
- Тест: dispatch 2+ задач одночасно на різних workers

**Інструмент:** `GET /api/runtime/agent-install-script?node_id=<name>&server_url=<url>`

---

### Пріоритет 4 — Покращення спостережуваності

**Опис:**

**4a. Ротація логів**
```bash
# /etc/logrotate.d/bloom-runtime
/var/log/bloom-runtime*.log {
    daily
    rotate 14
    compress
    missingok
    notifempty
    postrotate
        rc-service bloom-runtime restart
    endscript
}
```

**4b. Персистентний audit log до MinIO**
Періодичний flush `audit_logs` до MinIO як JSONL файл.

**4c. Alerting**
Email/webhook при `worker.offline`, `task.dead`, `lease.reaper.expired`.

---

## Семантичні зв'язки

**Цей документ залежить від:**
- [[СТАН_РОЗГОРТАННЯ_RUNTIME_ALPINE.md]] — базовий стан розгортання
- [[ВЕРИФІКАЦІЯ_ШЛЯХУ_ВИКОНАННЯ_RUNTIME.md]] — які кроки live vs blocked

**На цей документ посилаються:**
- [[../../ІНДЕКС.md]] — головний індекс
