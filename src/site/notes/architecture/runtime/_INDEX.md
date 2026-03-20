---
tags:
  - domain:arch
  - status:canonical
  - format:inventory
created: 2026-02-24
updated: 2026-03-15
tier: 2
title: "Архітектура Runtime — Індекс"
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
| [[ІНТЕГРАЦІЯ_MEMBRIDGE_ДИСПЕТЧЕР_ВИКОНАННЯ]] | Execution Dispatch — tasks, leasing, Claude CLI proxy executor |
| [[АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]] | Obsidian / MinIO / membridge — Memory Flow Architecture | canonical |
| [[BLOOM_RUNTIME_FAILURE_MODEL_V1]] | Failure model for BLOOM runtime | canonical |
| [[BLOOM_RUNTIME_MEMBRIDGE_CLAUDE_PROTOCOL_V1]] | Membridge↔Claude protocol | canonical |
| [[BLOOM_RUNTIME_NODE_CAPABILITIES_V1]] | Node capabilities | canonical |
| [[ІНТЕГРАЦІЯ_MEMBRIDGE_ПРОКСІ_CLAUDE_CLI]] | Claude CLI proxy integration | canonical |

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
