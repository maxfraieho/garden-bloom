# Frontend

Документація frontend-розробки Garden Bloom — онбординг, архітектура компонентів, API-інтеграція, UX.

## Онбординг та архітектура

| Файл | Опис | Статус |
|------|------|--------|
| [[ОНБОРДИНГ_РОЗРОБНИКА]] | Онбординг розробника — workflow з кроками і верифікаціями | canonical |
| [[АРХІТЕКТУРА_КОМПОНЕНТІВ]] | Компонентна ієрархія, групи, ownership map | canonical |
| [[domain/МОДЕЛЬ_ДОМЕНУ]] | Словник сутностей домену (Note, Agent, Zone, Proposal, Run, Memory) | canonical |

## Інтеграція та контракти

| Файл | Опис | Статус |
|------|------|--------|
| [[LOVABLE_УЗГОДЖЕННЯ_З_АРХІТЕКТУРОЮ_ВИКОНАННЯ]] | Контракт Lovable з архітектурою | canonical |
| [[ДИРЕКТИВА_УЗГОДЖЕННЯ_FRONTEND_V1]] | Критичні невідповідності UI | canonical |
| [[ПАМ_ЯТЬ_DIFFMEM_ІНТЕГРАЦІЯ]] | Memory / DiffMem frontend integration — depth modes, temporal UI, contracts | canonical |
| [[BLOOM_AUTH_UI_СПЕЦИФІКАЦІЯ]] | Auth UI специфікація | canonical |
| [[ПЛАН_МІГРАЦІЇ_FRONTEND_V1]] | Міграційний план frontend | historical |

## DiffMem temporal memory

| Файл | Опис | Статус |
|------|------|--------|
| [[diffmem/_INDEX]] | DiffMem frontend пакет — індекс | canonical |
| [[diffmem/УЗГОДЖЕННЯ_КОНТРАКТІВ_З_БЕКЕНДОМ]] | Таблиця термінів і контрактів backend↔frontend | canonical |
| [[diffmem/UI_UX_ТЕМПОРАЛЬНА_ПАМ_ЯТЬ]] | UI/UX spec для depth switcher, history panel, diff view | canonical |
| [[diffmem/СТАНИ_ДАНИХ_ТА_ВЕРИФІКАЦІЯ]] | View-model, інваріанти, сценарії перевірки | canonical |

## UX аудит

| Файл | Опис | Статус |
|------|------|--------|
| [[frontend/ux-audit/UX_АУДИТ_СИСТЕМИ_V1]] | Повний UX аудит системи | canonical |

## UX план

| Файл | Опис | Статус |
|------|------|--------|
| [[frontend/ux-plan/ПЛАН_ПОКРАЩЕННЯ_UX_V1]] | План покращення UX (3 пакети) | canonical |
| [[frontend/ux-plan/QA_ПАКЕТ_1_V1]] | QA-звіт Пакету 1 + mobile smoke tests | canonical |
| [[frontend/ux-plan/QA_HISTORY_E2E_V2]] | QA: end-to-end history flow | canonical |
| [[frontend/ux-plan/ГОТОВНІСТЬ_BACKEND_V1]] | Backend readiness: endpoints, gaps, projections | canonical |
| [[frontend/ux-plan/КЛАСТЕРИЗАЦІЯ_ПАПОК_ГРАФ_V1]] | Folder-based graph clustering approach | canonical |
| [[frontend/ux-plan/ВЕРИФІКАЦІЯ_ІНТЕГРАЦІЇ_API_V1]] | Worker routing & API base URL verification | canonical |
| [[frontend/ux-plan/ВЕРИФІКАЦІЯ_ПОТОКУ_PROPOSAL_HISTORY_V1]] | End-to-end proposal history flow verification | canonical |
| [[frontend/ux-plan/ПРОГАЛИНИ_ДАШБОРДУ_RUNS_BACKEND_V1]] | Runs dashboard backend gap analysis | canonical |
