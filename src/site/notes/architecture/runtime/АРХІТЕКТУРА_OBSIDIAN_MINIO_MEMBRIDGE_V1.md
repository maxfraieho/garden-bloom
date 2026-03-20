---
tags:
  - domain:arch
  - status:canonical
  - format:spec
  - tier:1
created: 2026-03-15
updated: 2026-03-15
title: "Архітектура Obsidian / MinIO / membridge — Memory Flow V1"
---

# Архітектура Obsidian / MinIO / membridge — Memory Flow V1

> Створено: 2026-03-15
> Автор: Головний архітектор системи
> Статус: Canonical
> Layer: Runtime Architecture
> Authority: BLOOM Runtime
> Scope: Obsidian vault / MinIO / obsidian-mcp / membridge — memory model та lifecycle мутацій
> Мова: Українська (канонічна)

---

## 1. Огляд

Цей шар визначає **модель памʼяті BLOOM runtime**, де Obsidian vault є human-readable джерелом правди для нотаток та memory, MinIO є sync backbone між vault та BLOOM, а membridge-клієнти є виконавчими воркерами без права прямого запису. Шар вирішує проблему **авторизованої мутації памʼяті**: гарантує, що жодна зміна не відбувається поза proposal/apply lifecycle і кожна мутація проходить явну згоду власника.

---

## 2. Компоненти моделі

| Компонент | Роль | Authority | Примітки |
|-----------|------|-----------|---------|
| **Obsidian vault** | Human-readable memory — markdown-нотатки, джерело правди для читача | Read/Write — ТІЛЬКИ через BLOOM apply | Git-based DiffMem; безпосередній запис заборонено |
| **MinIO / S3** | Sync backbone між vault та BLOOM runtime; object storage для persistence | Storage layer — не authority | BLOOM синхронізує vault↔MinIO; MinIO НЕ є джерелом правди |
| **obsidian-mcp** | MCP-сервер: контекстний міст для читання vault агентами | Read-only | НЕ є каналом запису; лише надає контекст |
| **BLOOM backend** | Єдина застосовуюча authority (single apply authority) | Write authority | Виконує apply після людського рішення; синхронізує MinIO↔vault |
| **membridge clients** | Runtime workers — диспетчеризація задач, виконання behavioral flows | Dispatch only — NO write | Пропонують зміни через proposal; НЕ мають прямого доступу до vault чи MinIO |

---

## 3. Memory Flow Diagram

```
Agent / membridge client
  │
  │  (1) генерує Proposal
  ▼
BLOOM backend (Proposal Store)
  │
  │  (2) Proposal зберігається, очікує рішення власника
  ▼
Власник (людина)
  │
  │  (3) approve / reject
  ▼
BLOOM backend — Apply Authority
  │
  │  (4) BLOOM виконує apply: пише зміни
  ▼
MinIO / S3 (sync backbone)
  │
  │  (5) BLOOM синхронізує MinIO ↔ Obsidian vault
  ▼
Obsidian vault (human-readable markdown memory)
  │
  │  (6) obsidian-mcp надає READ доступ агентам
  ▼
Agent context (read-only через obsidian-mcp)
```

**Ключовий інваріант:** стрілка завжди іде через BLOOM apply. Прямого шляху agent → vault не існує.

---

## 4. Канонічні інваріанти

1. **membridge clients НІКОЛИ не пишуть до vault напряму** — всі записи проходять виключно через BLOOM proposal/apply lifecycle.
2. **obsidian-mcp надає ТІЛЬКИ READ доступ** — це контекстний міст, не канал запису; агент не може змінити vault через obsidian-mcp.
3. **MinIO/S3 є sync layer, не authority** — MinIO синхронізується BLOOM backend; MinIO не приймає writes напряму від агентів чи membridge clients.
4. **Memory revisions є immutable append-only** — на основі git-based DiffMem model; попередні стани ніколи не видаляються, лише доповнюються.
5. **Proposal/apply lifecycle є ЄДИНИМ валідним шляхом мутації канонічної памʼяті** — будь-яке обходження цього шляху є порушенням архітектурного контракту.

---

## 5. Компонентні контракти

### obsidian-mcp

**МАЄ ПРАВО:**
- читати markdown-файли з Obsidian vault
- надавати контекст агентам (search, retrieval, wikilink traversal)
- відповідати на запити читання від будь-якого авторизованого клієнта

**НЕ МАЄ ПРАВА:**
- записувати будь-які зміни до vault
- приймати write-команди від агентів
- змінювати структуру vault або метадані файлів
- виступати посередником для запису (навіть опосередкованого)

### MinIO / S3

**Є:**
- sync backbone між BLOOM runtime та Obsidian vault
- object storage для persistence артефактів, proposals, audit log
- буфером синхронізації, яким керує BLOOM backend

**НЕ Є:**
- джерелом правди для canonical memory (vault — джерело правди)
- каналом запису для агентів або membridge clients
- authority для memory mutations

### BLOOM backend (Sole Apply Authority)

- Єдиний компонент, який виконує apply після human approval
- Отримує Proposal → зберігає → очікує рішення → після approve пише зміни до vault через MinIO sync
- Гарантує atomicity apply: або зміна потрапляє і до MinIO, і до vault, або не потрапляє зовсім
- Зберігає повний audit trail кожної мутації (хто запропонував, хто схвалив, що змінилось)
- НЕ виконує apply без explicit human approval (крім системних операцій, визначених окремим контрактом)

### membridge clients (Worker Constraints)

- Є runtime workers: приймають tasks, виконують behavioral flows, збирають артефакти
- МАЮ ПРАВО: генерувати Proposals та передавати їх до BLOOM backend
- МАЮ ПРАВО: читати контекст через obsidian-mcp (read-only)
- НЕ МАЮТЬ ПРАВА: писати до vault, MinIO або будь-якого canonical storage напряму
- НЕ МАЮТЬ ПРАВА: виконувати apply власноруч, навіть якщо мають технічний доступ
- Порушення цих обмежень є архітектурним порушенням і підлягає audit

---

## 6. Proposal/Apply: єдиний шлях мутацій

Будь-яка зміна канонічної памʼяті проходить наступний lifecycle:

```
1. Агент генерує Proposal
   └── містить: тип зміни, payload, контекст, обґрунтування

2. Proposal зберігається в BLOOM (Proposal Store)
   └── статус: pending

3. Власник (людина) бачить Proposal у Inbox
   └── рішення: approve / reject / modify

4. При approve → BLOOM виконує apply
   └── пише зміни до vault через MinIO sync
   └── записує audit entry

5. MinIO синхронізується з Obsidian vault
   └── vault оновлюється

6. Новий стан доступний через obsidian-mcp для наступного читання
```

**Відхилені Proposals** залишаються в BLOOM з статусом `rejected` — для auditability та аналізу.

**Скасований Proposal** не породжує змін у vault або MinIO.

**Немає обхідних шляхів.** Прямий запис до vault або MinIO без BLOOM apply є порушенням canonical contract.

---

## 7. Семантичні зв'язки

**Цей документ залежить від:**
- [[BLOOM_MEMORY_ARCHITECTURE]] — DiffMem persistence layer, memory lifecycle, execution context isolation
- [[КАНОНІЧНА_МОДЕЛЬ_АВТОРИТЕТУ_СХОВИЩА]] — storage authority model, MinIO як canonical storage, write authority matrix

**Цей документ доповнює:**
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ДИСПЕТЧЕР_ВИКОНАННЯ]] — execution dispatch, task leasing, worker capabilities
- [[ІНТЕГРАЦІЯ_MEMBRIDGE_ВИКОНАННЯ_DISPATCH]] — (якщо існує) — виконавчий dispatch
- [[INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]] — proposal system: повна специфікація lifecycle

**Пов'язані документи:**
- [[ПАМ_ЯТЬ_АГЕНТА_GIT_DIFFMEM_V1]] — git-based агентна памʼять, HARD ліміти
- [[EXECUTION_PROTOCOL]] — execution lifecycle, де memory binding відбувається на Stage 4/9/10

---

*Цей документ визначає канонічну архітектуру memory flow: Obsidian vault / MinIO / obsidian-mcp / BLOOM backend / membridge clients — з proposal/apply як єдиним шляхом мутацій.*
