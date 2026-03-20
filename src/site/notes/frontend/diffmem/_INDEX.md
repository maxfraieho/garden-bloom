---
tags:
  - domain:frontend
  - feature:memory
  - feature:diffmem
  - status:canonical
  - format:inventory
created: 2026-03-02
updated: 2026-03-02
title: "FRONTEND DIFFMEM INDEX"
dg-publish: true
---

# DiffMem для фронтенду — канонічний індекс

> Оновлено: 2026-03-02
> Мова: Українська (канонічна)
> Статус: Frontend-пакет для узгодження temporal memory з бекендом

---

## Призначення

Цей пакет описує лише фронтенд-проєкцію DiffMem-style GitDiff temporal memory.

Канонічним джерелом контрактів і термінів є бекенд-пакет:

- [[backend/КОНТРАКТИ_API_V1]] — Memory API §10
- [[architecture/runtime/BLOOM_MEMORY_ARCHITECTURE]] — canonical memory model
- [[architecture/features/ПАМ_ЯТЬ_АГЕНТА_GIT_DIFFMEM_V1]] — DiffMem git-based model

Фронтенд не вигадує власних temporal-контрактів, а лише:

- проєктує канонічні бекенд-дані в UI
- визначає UX-елементи для `depth`, history, diff і revision snapshot
- фіксує інваріанти, щоб не змішувати history з primary search

---

## Структура

| Документ | Призначення |
|----------|-------------|
| [[frontend/diffmem/УЗГОДЖЕННЯ_КОНТРАКТІВ_З_БЕКЕНДОМ]] | Таблиця термінів і контрактів `бекенд ↔ фронтенд` |
| [[frontend/diffmem/UI_UX_ТЕМПОРАЛЬНА_ПАМ_ЯТЬ]] | UI/UX-специфікація для depth switcher, history panel, diff view і temporal attachments |
| [[frontend/diffmem/СТАНИ_ДАНИХ_ТА_ВЕРИФІКАЦІЯ]] | View-model, інваріанти фронтенду й сценарії перевірки |

---

## Ключова аксіома

Фронтенд повинен зберегти канонічне розділення:

- `present-state search` — окремий UX-шлях для поточного стану
- `on-demand history` — окремий UX-шлях для temporal inspection

History не повинен виглядати як звичайний search result. Він має показуватися як:

- history panel
- diff viewer
- revision snapshot
- temporal attachments у контексті відповіді

---

## Рекомендований порядок читання

1. [[frontend/diffmem/УЗГОДЖЕННЯ_КОНТРАКТІВ_З_БЕКЕНДОМ]]
2. [[frontend/diffmem/UI_UX_ТЕМПОРАЛЬНА_ПАМ_ЯТЬ]]
3. [[frontend/diffmem/СТАНИ_ДАНИХ_ТА_ВЕРИФІКАЦІЯ]]

---

## Семантичні зв'язки

- Frontend index: [[frontend/_INDEX]]
- Frontend/backend alignment: [[frontend/ux-plan/ГОТОВНІСТЬ_BACKEND_V1]]
- Existing frontend memory contract: [[memory/API_CONTRACT]]
- Canonical runtime memory model: [[architecture/features/ПАМ_ЯТЬ_АГЕНТА_GIT_DIFFMEM_V1]]
