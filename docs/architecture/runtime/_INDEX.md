---
tags:
  - domain:arch
  - status:canonical
  - format:inventory
created: 2026-02-24
updated: 2026-02-24
tier: 2
title: "Runtime Architecture — Index"
---

# Runtime Architecture — Index

> Статус: Canonical
> Layer: Runtime Architecture
> Мова: Українська (канонічна)

---

## Документи цього пакету

| Документ | Опис |
|----------|------|
| [[EXECUTION_PROTOCOL]] | Канонічний протокол виконання — 11-стадійний lifecycle |
| [[BLOOM_MEMORY_ARCHITECTURE]] | Memory Architecture — DiffMem як persistence layer |
| [[INTEGRATION_MEMBRIDGE_EXECUTION_DISPATCH]] | Execution Dispatch — tasks, leasing, Claude CLI proxy executor |

---

## Scope

Runtime Architecture визначає **як** BLOOM Runtime виконує behavioral logic:

- Execution Protocol — lifecycle від Intent до Completion
- Memory Architecture — persistence, isolation, replay
- Execution Dispatch — distributed task dispatch через membridge

---

## Семантичні зв'язки

**Цей індекс є частиною:**
- [[АРХІТЕКТУРНИЙ_КОРІНЬ]] — runtime як частина загальної архітектури

**Залежить від:**
- [[BLOOM_RUNTIME_IDENTITY]] — canonical identity

**Доповнює:**
- [[КОНТРАКТ_АГЕНТА_V1]] — хто виконує
- [[АБСТРАКЦІЯ_РІВНЯ_ОРКЕСТРАЦІЇ]] — як оркеструється

---

*Цей документ є індексом пакету Runtime Architecture у BLOOM Runtime.*
