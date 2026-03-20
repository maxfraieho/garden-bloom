---
tags:
  - domain:operations
  - status:canonical
  - format:guide
  - tier:2
created: 2026-03-15
updated: 2026-03-15
title: "Runbook: Впровадження Obsidian / MinIO / membridge — Memory Stack"
---

# Runbook: Впровадження Obsidian / MinIO / membridge — Memory Stack

> Створено: 2026-03-15
> Автор: Операційна команда BLOOM
> Статус: Canonical
> Layer: Operations
> Scope: Покроковий runbook для розгортання memory stack: MinIO + Obsidian vault + obsidian-mcp + BLOOM backend + membridge
> Мова: Українська (канонічна)

---

## 1. Для кого цей runbook

Цей runbook призначений для:

- **BLOOM operator** — інженер, що розгортає та обслуговує BLOOM runtime
- **DevOps / Integrator** — фахівець, що інтегрує memory stack у нову інсталяцію BLOOM

Читач має розуміти базові концепції BLOOM архітектури. Для контексту — [[АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]].

---

## 2. Передумови

Перед початком переконайтесь, що виконані всі пункти:

- [ ] **MinIO instance** доступний (локально або cloud) — endpoint, access key, secret key відомі
- [ ] **Obsidian vault** — шлях до vault директорії відомий і доступний на файловій системі
- [ ] **obsidian-mcp** встановлений або може бути встановлений (`npm`/`npx` доступні)
- [ ] **BLOOM backend** запущений або готовий до запуску
- [ ] **membridge** клієнти налаштовані або готові до конфігурації
- [ ] **Git** ініціалізований у vault директорії (для DiffMem)
- [ ] **Node.js 18+** доступний (для obsidian-mcp)

---

## 3. Крок 1: MinIO — налаштування bucket

### 3.1. Створити bucket

```bash
# Через mc (MinIO client)
mc alias set bloom http://<MINIO_HOST>:<MINIO_PORT> <ACCESS_KEY> <SECRET_KEY>
mc mb bloom/bloom-memory
mc mb bloom/bloom-proposals
mc mb bloom/bloom-audit
```

### 3.2. Налаштувати credentials

```bash
# Переконатись, що bucket доступний
mc ls bloom/bloom-memory
```

### 3.3. Конфігурація BLOOM backend для підключення до MinIO

У `.env` або конфігурації BLOOM backend:

```env
MINIO_ENDPOINT=http://<MINIO_HOST>:<MINIO_PORT>
MINIO_ACCESS_KEY=<ACCESS_KEY>
MINIO_SECRET_KEY=<SECRET_KEY>
MINIO_BUCKET_MEMORY=bloom-memory
MINIO_BUCKET_PROPOSALS=bloom-proposals
MINIO_BUCKET_AUDIT=bloom-audit
MINIO_USE_SSL=false
```

### 3.4. Верифікація

```bash
# BLOOM backend має успішно підключитись до MinIO при старті
# Перевірити у логах: "MinIO connected: OK"
```

---

## 4. Крок 2: Obsidian vault — налаштування

### 4.1. Визначити шлях до vault

```bash
# Переконатись, що vault директорія існує і містить markdown-файли
ls <VAULT_PATH>/
# Очікується: .obsidian/, *.md файли, можливо subdirectories
```

### 4.2. Перевірити markdown структуру

Vault має відповідати DiffMem-сумісній структурі:
- Файли у форматі Markdown (`.md`)
- Frontmatter де потрібно (YAML між `---`)
- Wikilinks (`[[назва]]`) для перехресних посилань

### 4.3. Ініціалізувати git для DiffMem

```bash
cd <VAULT_PATH>
git init
git add .
git commit -m "init: initial vault state"
```

**ВАЖЛИВО:** Git — обовʼязковий для DiffMem temporal reasoning. Без git history — DiffMem деградує до basic context.

### 4.4. Конфігурація BLOOM backend для vault

```env
OBSIDIAN_VAULT_PATH=<VAULT_PATH>
OBSIDIAN_VAULT_GIT_ENABLED=true
```

---

## 5. Крок 3: obsidian-mcp — встановлення та конфігурація

### 5.1. Встановити obsidian-mcp

```bash
npm install -g obsidian-mcp
# або через npx без встановлення:
# npx obsidian-mcp --vault <VAULT_PATH>
```

### 5.2. Конфігурувати MCP сервер

У `.mcp.json` або конфігурації Claude Code / BLOOM MCP:

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "npx",
      "args": ["-y", "obsidian-mcp", "--vault", "<VAULT_PATH>"]
    }
  }
}
```

### 5.3. Тестування READ доступу

```bash
# Запустити obsidian-mcp і перевірити, що він відповідає на read-запити
npx obsidian-mcp --vault <VAULT_PATH> --test-read
```

Очікуваний результат: список файлів та їх зміст доступний через MCP protocol.

### 5.4. Верифікація відсутності write path

obsidian-mcp не має і не повинен мати write endpoint. Перевірити конфігурацію:

```bash
# Переконатись, що в конфігурації немає write permissions
# obsidian-mcp надає виключно READ tools
```

**ВАЖЛИВО:** Якщо у вашій версії obsidian-mcp є write tools — заблокувати їх на рівні MCP permissions або використати read-only fork.

---

## 6. Крок 4: BLOOM backend — конфігурація sync та apply

### 6.1. Конфігурація MinIO sync

BLOOM backend синхронізує vault↔MinIO. Перевірити, що sync job активований:

```env
BLOOM_MINIO_SYNC_ENABLED=true
BLOOM_MINIO_SYNC_INTERVAL_MS=30000
BLOOM_VAULT_SYNC_DIRECTION=bidirectional
```

### 6.2. Тест: створення Proposal

```bash
# Через BLOOM API або CLI — створити тестовий proposal
curl -X POST http://<BLOOM_BACKEND>/api/proposals \
  -H "Content-Type: application/json" \
  -d '{
    "type": "memory.write",
    "payload": {
      "path": "test/hello.md",
      "content": "# Test\nHello from BLOOM apply test."
    },
    "context": "runbook-verification",
    "justification": "Тестовий proposal для верифікації apply path"
  }'
```

Очікуваний результат: `{ "status": "pending", "proposalId": "..." }`

### 6.3. Тест: apply пише до vault через MinIO

```bash
# Схвалити proposal через BLOOM API
curl -X POST http://<BLOOM_BACKEND>/api/proposals/<PROPOSAL_ID>/approve

# Перевірити, що файл зʼявився у vault
ls <VAULT_PATH>/test/hello.md
```

Очікуваний результат: файл `test/hello.md` існує з правильним вмістом.

---

## 7. Крок 5: membridge — конфігурація клієнтів

### 7.1. Конфігурація membridge як dispatch-only worker

```env
MEMBRIDGE_MODE=worker
MEMBRIDGE_WRITE_DIRECT=false        # ОБОВЯЗКОВО false
MEMBRIDGE_PROPOSAL_ENDPOINT=http://<BLOOM_BACKEND>/api/proposals
MEMBRIDGE_READ_ENDPOINT=http://<BLOOM_BACKEND>/api/memory
```

**КРИТИЧНО:** `MEMBRIDGE_WRITE_DIRECT=false` — membridge ніколи не пише напряму. Будь-яке значення `true` є архітектурним порушенням.

### 7.2. Верифікація dispatch-only режиму

```bash
# Запустити membridge і перевірити, що він лише диспетчеризує proposals
# У логах НЕ повинно бути "direct write to vault" або "direct MinIO write"
```

### 7.3. Перевірити read через obsidian-mcp

```bash
# membridge може читати контекст через obsidian-mcp
# Перевірити, що read запити проходять
```

---

## 8. Верифікація: end-to-end flow

Повна перевірка memory stack:

### Крок 1: Створити Proposal через membridge

```bash
# Симулювати агента, що створює proposal
curl -X POST http://<BLOOM_BACKEND>/api/proposals \
  -H "Content-Type: application/json" \
  -d '{
    "type": "memory.write",
    "payload": {
      "path": "agents/test-agent/memory/e2e-test.md",
      "content": "# E2E Test\nCreated: 2026-03-15\nStatus: verified"
    },
    "source": "membridge-e2e-test",
    "justification": "End-to-end верифікація memory stack"
  }'
```

### Крок 2: Схвалити Proposal (дія власника)

```bash
# Знайти proposal у BLOOM Inbox і схвалити
curl -X POST http://<BLOOM_BACKEND>/api/proposals/<PROPOSAL_ID>/approve
```

### Крок 3: Перевірити vault

```bash
# Vault має містити новий файл після apply
cat <VAULT_PATH>/agents/test-agent/memory/e2e-test.md
```

Очікуваний результат: файл існує з правильним вмістом.

### Крок 4: Перевірити MinIO sync

```bash
mc ls bloom/bloom-memory/agents/test-agent/memory/
# Файл має бути присутнім у MinIO bucket
```

### Крок 5: Перевірити read через obsidian-mcp

```bash
# Зробити read-запит через obsidian-mcp — новий файл має бути доступний
```

**Результат верифікації:** якщо всі 5 кроків пройшли успішно — memory stack працює коректно.

---

## 9. Діагностика

### MinIO unreachable

**Симптом:** BLOOM backend не може підключитись до MinIO; помилка у логах.

**Перевірка:**
```bash
mc ping bloom
# або
curl http://<MINIO_HOST>:<MINIO_PORT>/minio/health/live
```

**Рішення:** перевірити endpoint, credentials, firewall rules, SSL конфігурацію.

---

### Vault path wrong / не знайдено

**Симптом:** obsidian-mcp або BLOOM sync повертають "vault not found" або порожній список файлів.

**Перевірка:**
```bash
ls <VAULT_PATH>/.obsidian/
# Директорія .obsidian/ є ознакою валідного vault
```

**Рішення:** перевірити `OBSIDIAN_VAULT_PATH` у конфігурації, перевірити права читання.

---

### obsidian-mcp read fails

**Симптом:** агент не може отримати контекст; MCP повертає помилку.

**Перевірка:**
```bash
npx obsidian-mcp --vault <VAULT_PATH> --list-files
```

**Рішення:** перевірити, що vault path правильний, vault не пустий, obsidian-mcp версія сумісна.

---

### Proposal stuck (status: pending)

**Симптом:** proposal залишається у статусі `pending` після схвалення; vault не оновлюється.

**Перевірка:**
```bash
# Перевірити статус proposal
curl http://<BLOOM_BACKEND>/api/proposals/<PROPOSAL_ID>

# Перевірити BLOOM backend logs на apply errors
```

**Рішення:** перевірити, що MinIO доступний під час apply, перевірити vault path на write permissions, перевірити git status у vault.

---

### membridge намагається писати напряму

**Симптом:** у логах membridge — "direct write" або помилка "permission denied on vault".

**Рішення:** примусово встановити `MEMBRIDGE_WRITE_DIRECT=false`; якщо проблема в коді — це архітектурне порушення, що потребує виправлення у membridge client.

---

## 10. Семантичні зв'язки

**Цей runbook є операційною реалізацією:**
- [[АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]] — канонічна архітектурна специфікація цього stack

**Залежить від:**
- [[BLOOM_MEMORY_ARCHITECTURE]] — DiffMem persistence model
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ДИСПЕТЧЕР_ВИКОНАННЯ]] — membridge execution dispatch

**Пов'язані документи:**
- [[КАНОНІЧНА_МОДЕЛЬ_АВТОРИТЕТУ_СХОВИЩА]] — storage authority matrix
- [[INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]] — proposal system lifecycle

---

*Цей runbook є покроковим операційним керівництвом для впровадження Obsidian / MinIO / membridge memory stack у BLOOM runtime.*
