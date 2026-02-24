---
{"tags":["domain:arch","status:canonical","format:spec","feature:execution"],"created":"2026-02-24","updated":"2026-02-24","tier":1,"title":"EXECUTION PROTOCOL — BLOOM Runtime","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/runtime/EXECUTION_PROTOCOL/","dgPassFrontmatter":true,"noteIcon":""}
---


# EXECUTION PROTOCOL — BLOOM Runtime

> Створено: 2026-02-24
> Автор: Головний архітектор системи
> Статус: Canonical
> Мова: Українська (канонічна)

---

## 1. Визначення

**Execution Protocol** — канонічний протокол, що визначає повний життєвий цикл виконання behavioral logic у BLOOM runtime.

Протокол визначає:

- як behavioral logic переходить у execution
- як runtime делегує виконання агентам
- як execution контролюється, аудитується і завершується

### Гарантії протоколу

| Гарантія | Опис |
|----------|------|
| Determinism | Однаковий input → однаковий execution path |
| Auditability | Кожен крок записується у immutable audit log |
| Isolation | Execution contexts ізольовані один від одного |
| Replayability | Будь-який execution може бути відтворений |
| Distributed execution | Виконання делегується через lease model |

---

## 2. Execution Pipeline

Execution lifecycle має канонічну послідовність:

```
Intent
  → Inbox Entry
    → Proposal
      → Canonical Storage
        → Compilation
          → IR Creation
            → Job Creation
              → Lease to Agent
                → Execution
                  → Artifact Creation
                    → Audit Log Entry
                      → Completion
```

---

## 3. Pipeline Stages

### Stage 1 — Intent

Intent — намір змінити стан системи або виконати behavioral logic.

**Джерела intent:**
- user (власник)
- agent (делегований)
- external integration
- scheduled event

### Stage 2 — Inbox Entry

Intent нормалізується у **Inbox Entry** з canonical format.

Inbox є **trust boundary** — жодний intent не проходить без нормалізації.

### Stage 3 — Proposal

**Proposal** є immutable artifact.

Proposal НЕ виконується без explicit approval від власника (Axiom A1: Owner Sovereignty).

**Proposal lifecycle:**

| Стан | Опис |
|------|------|
| `pending` | Очікує рішення власника |
| `approved` | Схвалено, готове до execution |
| `rejected` | Відхилено |
| `applied` | Виконано, результат записано |

### Stage 4 — Canonical Storage

Approved Proposal записується у **canonical storage**.

Canonical storage є єдиним source of truth для всіх execution artifacts.

### Stage 5 — Compilation

Behavioral definition компілюється:

```
DRAKON schema
  → Pseudocode
    → IR (Intermediate Representation)
```

**IR є єдиним execution format.** Runtime не виконує DRAKON напряму.

### Stage 6 — Job Creation

Runtime створює **Job** — атомарну одиницю виконання.

**Job structure:**

| Поле | Тип | Опис |
|------|-----|------|
| `id` | UUID | Унікальний ідентифікатор |
| `ir_reference` | string | Посилання на IR artifact |
| `context_id` | UUID | Execution Context |
| `created_at` | timestamp | Час створення |
| `status` | enum | `created` / `leased` / `executing` / `completed` / `failed` / `aborted` |

### Stage 7 — Lease

Runtime делегує Job агенту через **Lease**.

**Lease гарантує:**
- Single executor — лише один агент виконує Job
- Exclusive execution — без конкурентного доступу
- Timeout — lease має обмежений час дії

### Stage 8 — Execution

Agent виконує IR згідно з [[КОНТРАКТ_АГЕНТА_V1]].

**Можливі результати:**
- `complete` — успішне завершення
- `fail` — помилка виконання
- `timeout` — перевищення часу lease

Execution створює artifacts.

### Stage 9 — Artifact Creation

**Artifacts** є результатом execution.

Властивості artifacts:
- Immutable — не змінюються після створення
- Audit-linked — прив'язані до Job через `job_id`
- Versioned — мають version identifier

### Stage 10 — Audit Log

Execution записується у **immutable audit log**.

**Audit log entry:**

| Поле | Опис |
|------|------|
| `actor` | Хто виконав (agent ID або system) |
| `action` | Тип дії |
| `job_id` | Пов'язаний Job |
| `timestamp` | Час запису |
| `context_id` | Execution Context |

### Stage 11 — Completion

Job переходить у terminal state:

| Стан | Опис |
|------|------|
| `completed` | Успішне завершення |
| `failed` | Помилка виконання |
| `aborted` | Примусове припинення |

Execution lifecycle завершено.

---

## 4. Execution Context Isolation

Execution відбувається у **Execution Context**.

Execution Context містить:
- agents — набір делегованих агентів
- memory bindings — зв'язки через membridge
- runtime state — стан виконання
- delegated zones — зони відповідальності агентів

**Execution contexts ізольовані.** Жоден агент не має доступу до іншого контексту без explicit delegation.

---

## 5. Відношення до BLOOM Runtime

| Шар | Роль |
|-----|------|
| Execution Protocol | Protocol layer — визначає *як* виконується |
| BLOOM Runtime | Execution environment — *де* виконується |
| Agent Contract | Execution contract — *хто* виконує |

Execution Protocol є **orchestration contract** BLOOM runtime.

---

## 6. Семантичні зв'язки

**Цей документ залежить від:**
- [[КАНОНІЧНА_АРХІТЕКТУРА_ВИКОНАННЯ]] — повна архітектура виконання
- [[КОНТРАКТ_АГЕНТА_V1]] — контракт агента
- [[АБСТРАКЦІЯ_РІВНЯ_ОРКЕСТРАЦІЇ]] — orchestration layer contract
- [[BLOOM_RUNTIME_IDENTITY]] — execution identity

**Цей документ доповнює:**
- [[КАНОНІЧНИЙ_КОНВЕЄР_ВИКОНАННЯ]] — деталі pipeline
- [[КАНОНІЧНИЙ_ЦИКЛ_ЗАПУСКУ]] — state machine runs
- [[INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]] — Proposal system

---

*Цей документ визначає канонічний протокол виконання behavioral logic у BLOOM runtime.*
