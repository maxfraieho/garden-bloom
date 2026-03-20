---
tags:
  - domain:storage
  - status:canonical
  - format:contract
  - feature:storage
created: 2026-02-24
updated: 2026-02-27
tier: 1
title: "Інтеграція: Membridge Control Plane + Runtime Proxy"
dg-publish: true
---

# Інтеграція: Membridge Control Plane + Runtime Proxy

> Created: 2026-02-24
> Updated: 2026-02-27 (додано Runtime proxy, зовнішній доступ, Protocol V1 heartbeat)
> Author: architect
> Status: canonical
> Мова: Ukrainian (canonical)

---

## 0. Призначення

Визначає архітектурну роль Membridge у системі Garden Bloom як інфраструктурного шару синхронізації пам'яті Claude CLI між вузлами мережі.

Membridge управляє синхронізацією `claude-mem.db` (SQLite) між edge-вузлами (Alpine, RPi, Orange Pi) та об'єктним сховищем MinIO. Він є незалежним від `garden-bloom-memory` git-монорепо — два сховища обслуговують різні шари пам'яті:

| Сховище | Тип пам'яті | Хто пише |
|---------|-------------|---------|
| `claude-mem.db` → MinIO (через Membridge) | Claude CLI session memory | Claude CLI + membridge hooks |
| `garden-bloom-memory` (git) | Agent reasoning memory (Layer 1/2) | Apply Engine via Proposals |

**Аксіома A1:** MinIO є canonical object storage; Membridge є гейткіпером запису до нього для claude-mem.

---

## 1. Компоненти

```
Alpine (192.168.3.184 / bloom.exodus.pp.ua)
├── bloom-runtime     :5000   ← BLOOM Runtime (Express); proxy до CP через /api/membridge/*
├── membridge-server  :8000   ← Control Plane API; leadership registry; Web UI
├── membridge-agent   :8001   ← Local agent; Claude CLI executor; heartbeat sender
└── cloudflared              ← Cloudflare Tunnel → bloom.exodus.pp.ua → :5000

RPi / Orange Pi (edge nodes)
└── membridge-agent   :8001   ← Local sync; Claude CLI executor; heartbeat до Alpine :8000 + :5000
```

### 1.0 BLOOM Runtime як Proxy (НОВЕ)

BLOOM Runtime (Express :5000) проксіює запити до Membridge CP:

```
Frontend (Lovable SPA)
  │ GET /api/membridge/projects
  ▼
BLOOM Runtime :5000
  │ inject X-MEMBRIDGE-ADMIN header
  │ proxy → localhost:8000/projects
  ▼
Membridge CP :8000
```

**Ендпоїнти proxy:**

| Runtime шлях | Proxy до CP | Опис |
|-------------|------------|------|
| `GET /api/membridge/health` | `GET :8000/health` | Health check |
| `GET /api/membridge/projects` | `GET :8000/projects` | Список sync проєктів |
| `GET /api/membridge/projects/:cid/leadership` | `GET :8000/projects/:cid/leadership` | Leadership lease |
| `GET /api/membridge/projects/:cid/nodes` | `GET :8000/projects/:cid/nodes` | Ноди проєкту |
| `POST /api/membridge/projects/:cid/leadership/select` | `POST :8000/projects/:cid/leadership/select` | Promote primary |

**Критично:** Frontend НІКОЛИ не звертається до CP напряму. Тільки через Runtime proxy.

### 1.0.1 Зовнішній доступ

**`bloom.exodus.pp.ua`** — Cloudflare Tunnel до Alpine :5000. Це єдина точка входу для Lovable Frontend та будь-яких зовнішніх клієнтів.

Без цього тунелю інтеграція Frontend ↔ Runtime **неможлива**, оскільки Lovable SPA хостується на `*.lovable.app` і не має доступу до приватного LAN `192.168.3.0/24`.

### 1.1 membridge-server (Control Plane)

- FastAPI; порт 8000
- Приймає heartbeats від агентів
- Реєструє проекти та вузли
- Надає leadership API (select primary, view lease)
- Служить Web UI на `/ui` (→ `/static/ui.html`)

### 1.2 membridge-agent (Edge Agent)

- FastAPI; порт 8001
- Зберігає локальний реєстр проектів (`~/.membridge/agent_projects.json`)
- Надсилає heartbeat до control plane кожні `MEMBRIDGE_HEARTBEAT_INTERVAL_SECONDS` (default: 10s)
- Auth-exempt для localhost; вимагає `X-MEMBRIDGE-AGENT` для remote

---

## 2. Leadership Model (Модель лідерства)

### 2.1 Ролі вузлів

| Роль | Дозволи |
|------|---------|
| **Primary** (Первинний) | Push до MinIO ✅ · Pull → відмовляє якщо є local DB ✅ |
| **Secondary** (Вторинний) | Push → заблоковано за замовчуванням ❌ · Pull (з backup) ✅ |

**Інваріант:** лише один вузол є Primary для кожного проекту в будь-який момент часу.

### 2.2 Leadership Lease (Оренда лідерства)

Зберігається в MinIO: `projects/<canonical_id>/leadership/lease.json`

```json
{
  "canonical_id":     "sha256(project_name)[:16]",
  "primary_node_id":  "alpine",
  "issued_at":        1706000000,
  "expires_at":       1706003600,
  "lease_seconds":    3600,
  "epoch":            3,
  "policy":           "primary_authoritative",
  "issued_by":        "alpine",
  "needs_ui_selection": false
}
```

**Поле `epoch`:** монотонно зростає при кожному поновленні. Запобігає гонці стану між двома вузлами, що одночасно намагаються стати Primary.

### 2.3 Lease State Machine

```
                ┌──────────────┐
                │   ABSENT     │
                └──────┬───────┘
                       │ перший запис
                ┌──────▼───────┐
          ┌─────│    VALID     │─────┐
          │     └──────┬───────┘     │
          │ current    │ expires_at  │ current
          │ node =     │ пройшло     │ node ≠
          │ primary    ▼             │ primary
          │     ┌──────────────┐     │
          │     │   EXPIRED    │     │
          │     └──────┬───────┘     │
          │            │             │
          │   PRIMARY_NODE_ID        │
          │   matches current?       │
          │   YES → renew (epoch+1)  │
          ▼   NO → secondary        ▼
      [Primary]                 [Secondary]
```

### 2.4 Визначення ролі (алгоритм)

```
1. Читати lease.json з MinIO
2. Якщо відсутній → створити (primary = PRIMARY_NODE_ID env або current node)
3. Якщо expired:
   а. Якщо PRIMARY_NODE_ID == NODE_ID → поновити lease (epoch+1)
   б. Інакше → перечитати; якщо ще expired → роль = secondary
4. Якщо valid:
   роль = primary  якщо primary_node_id == NODE_ID
   роль = secondary інакше
```

---

## 3. Push / Pull Protocol (Протокол синхронізації)

### 3.1 Primary Push

```
1. Перевірити роль → primary ✅
2. Зупинити worker (для консистентного snapshot)
3. VACUUM INTO temp + перевірка цілісності
4. Перезапустити worker
5. Обчислити SHA256 snapshot
6. Порівняти з remote SHA256 (пропустити якщо однакові)
7. Отримати distributed push lock
8. Upload DB + SHA256 + manifest до MinIO
9. Верифікувати remote SHA256
```

### 3.2 Secondary Pull

```
1. Перевірити роль → secondary ✅
2. Завантажити remote SHA256
3. Порівняти з local (пропустити якщо однакові)
4. Завантажити remote DB до temp файлу
5. Верифікувати SHA256
6. Safety backup local DB → ~/.claude-mem/backups/pull-overwrite/<ts>/
7. Зупинити worker
8. Атомарна заміна local DB
9. Перевірити цілісність + перезапустити worker
```

### 3.3 Lock Model

| Тип | Шлях у MinIO | TTL | Призначення |
|-----|-------------|-----|-------------|
| Push lock | `projects/<cid>/locks/active.lock` | `LOCK_TTL_SECONDS` (2h) | Заборона паралельних push |
| Leadership lease | `projects/<cid>/leadership/lease.json` | `LEADERSHIP_LEASE_SECONDS` (1h) | Визначення Primary/Secondary |

Push lock та Leadership lease — незалежні механізми.

---

## 4. Artifact Registry (Реєстр артефактів)

Membridge Control Plane веде метаданий реєстр артефактів у MinIO:

```
projects/<canonical_id>/
├── artifacts/
│   └── <artifact_id>.json     ← metadata: type, job_id, created_at, url
├── leadership/
│   ├── lease.json
│   └── audit/<ts>-<node_id>.json
├── locks/
│   └── active.lock
└── db/
    ├── <sha256>.db             ← canonical SQLite snapshot
    └── <sha256>.sha256
```

**Immutability rule:** артефакт після запису до MinIO є immutable. Повторний запис з тим самим `artifact_id` повертає наявний запис без помилки (ідемпотентний).

---

## 5. Control Plane API (Поверхня API)

### 5.1 Public endpoints (без автентифікації)

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/health` | Service health |
| `GET` | `/ui` | → redirect до `/static/ui.html` |

### 5.2 Admin endpoints (вимагають `X-MEMBRIDGE-ADMIN`)

| Метод | Шлях | Опис |
|-------|------|------|
| `GET` | `/projects` | Список проектів (manual + heartbeat) |
| `GET` | `/projects/<cid>/leadership` | Поточний lease |
| `POST` | `/projects/<cid>/leadership/select` | Вибір Primary вузла |
| `GET` | `/agents` | Список зареєстрованих агентів |
| `POST` | `/agent/heartbeat` | Прийом heartbeat від агента |
| `GET` | `/jobs` | Список Job (статус, тип) |
| `PATCH` | `/jobs/<id>/status` | Оновлення статусу Job |
| `POST` | `/jobs/<id>/requeue` | Повторна постановка DEAD job |

### 5.3 Agent endpoints (порт 8001; `X-MEMBRIDGE-AGENT` для remote)

| Метод | Шлях | Auth | Опис |
|-------|------|------|------|
| `GET` | `/health` | — | Agent health |
| `GET` | `/projects` | — | Local project registry |
| `POST` | `/register_project` | localhost exempt | Реєстрація проекту |

---

## 6. Environment Variables (Override Protocol)

Змінні CLI-середовища перекривають значення з `config.env`. Реалізовано через save/restore pattern у hooks.

| Змінна | Default | Призначення |
|--------|---------|-------------|
| `FORCE_PUSH` | `0` | Примусовий push (обходить stale lock) |
| `ALLOW_SECONDARY_PUSH` | `0` | Дозволити Secondary push (unsafe) |
| `ALLOW_PRIMARY_PULL_OVERRIDE` | `0` | Дозволити Primary pull-overwrite (unsafe) |
| `STALE_LOCK_GRACE_SECONDS` | `60` | Додатковий grace після закінчення TTL lock |
| `LOCK_TTL_SECONDS` | `7200` | TTL push lock |
| `LEADERSHIP_LEASE_SECONDS` | `3600` | TTL leadership lease |
| `LEADERSHIP_ENABLED` | `1` | `0` → вимкнути всі leadership перевірки |

---

## 7. Heartbeat Flow (Потік heartbeat)

```
membridge-agent (port 8001)
        │
        │ кожні HEARTBEAT_INTERVAL_SECONDS (default 10s)
        │ читає ~/.membridge/agent_projects.json
        │
        ▼
POST /agent/heartbeat  →  membridge-server (port 8000)
{
  "node_id":      "alpine",
  "canonical_id": "abc123def456abcd",
  "project_id":   "garden-seedling",
  "ip_addrs":     ["192.168.3.184"],
  "obs_count":    1234,
  "db_sha":       "deadbeef..."
}
        │
        ▼
server: _nodes[] + _heartbeat_projects[] (in-memory)
        │
        ▼
GET /projects → Frontend (Web UI)
```

**Примітка:** `_heartbeat_projects` зберігаються в пам'яті сервера. Після рестарту сервера відновлюються через наступний heartbeat цикл (≤ HEARTBEAT_INTERVAL_SECONDS).

---

## 8. Failure Scenarios та Recovery

| Сценарій | Поведінка | Recovery |
|----------|-----------|----------|
| Primary offline; lease expired | Secondary не може push; needs_ui_selection стає true | Operator: `POST /projects/<cid>/leadership/select` для нового Primary |
| Push lock stuck | Наступний push: steal lock після TTL + grace | `FORCE_PUSH=1 cm-push` або чекати TTL |
| MinIO недоступний | Push → error; pull → error | Всі операції fail-safe; local DB незмінна |
| Secondary local-ahead | Secondary має більше записів ніж remote | Promote Secondary → Primary, потім push |
| Agent reboots | Heartbeat відновлюється автоматично | Нічого не потрібно; cервер оновить стан |
| Server reboot | _heartbeat_projects очищуються | Відновлення через ≤ HEARTBEAT_INTERVAL_SECONDS |

---

---

## 9. Два типи Heartbeat (КРИТИЧНО для розуміння)

У системі існують **два незалежних** heartbeat потоки:

| Тип | Від | До | Інтервал | Призначення |
|-----|-----|-----|----------|-------------|
| **Membridge heartbeat** | Agent :8001 | CP :8000 | 10с | Worker discovery, project registry |
| **Task heartbeat** | Agent :8001 | Runtime :5000 | 10с | Підтримка lease під час виконання задачі |

**Membridge heartbeat** — постійний, працює завжди поки агент запущений.
**Task heartbeat** — тимчасовий, працює тільки під час виконання конкретної задачі (між dispatch і complete).

Якщо task heartbeat зупиняється (worker crash, мережева помилка), Lease Reaper через 15с виявить expired lease і виконає requeue або позначить задачу dead.

---

## Semantic Relations

**Цей документ є частиною:**
- [[_INDEX]] — Integration Layer, індекс пакету

**Залежить від:**
- [[АРХІТЕКТУРНИЙ_КОРІНЬ]] — A1 (MinIO canonical), A2 (consent-based mutation)
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI]] — Protocol V1 деталі

**На цей документ посилаються:**
- [[ТОПОЛОГІЯ_RUNTIME_NOTEBOOKLM]] — Membridge як вузол топології
- [[ПАКЕТ_ІНТЕГРАЦІЇ_V1]] — практичний bundle
- [[ІНТЕГРАЦІЯ_FRONTEND_LOVABLE]] — proxy endpoints
