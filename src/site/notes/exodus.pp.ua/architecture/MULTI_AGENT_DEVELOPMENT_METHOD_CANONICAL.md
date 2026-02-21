---
{"tags":["domain:arch","status:canonical","format:spec","feature:execution","feature:proposal"],"created":"2026-02-21","updated":"2026-02-21","status":"canonical","domain":"architecture","tier":1,"authority":"architectural","governs":["agent_roles","development_method","architectural_authority_model"],"related":["ARCHITECTURE_ROOT","RUNTIME_ARCHITECTURE_CANONICAL"],"title":"MULTI_AGENT_DEVELOPMENT_METHOD_CANONICAL","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/architecture/MULTI_AGENT_DEVELOPMENT_METHOD_CANONICAL/","dgPassFrontmatter":true,"noteIcon":""}
---


# MULTI_AGENT_DEVELOPMENT_METHOD_CANONICAL

## 0. Норма документа

Цей документ є **канонічною архітектурною специфікацією** методу мультиагентної розробки Garden Bloom.

- Він визначає governance, authority boundaries та mutation constraints між агентами і людиною.
- Він **не** визначає runtime-деталі виконання (вони описані в [[exodus.pp.ua/architecture/RUNTIME_ARCHITECTURE_CANONICAL\|RUNTIME_ARCHITECTURE_CANONICAL]] та пов’язаних runtime-специфікаціях).
- Він є частиною knowledge graph документації (див. [[exodus.pp.ua/architecture/GRAPH_MAP\|GRAPH_MAP]]), тобто є **архітектурним субстратом**, а не допоміжним текстом.

---

## 1. Призначення та область дії

### 1.1 Що таке multi-agent development method

Multi-agent development method — це формалізована модель розробки Garden Bloom, де:

1) кожен AI-агент має чітко визначену роль і межі влади  
2) жоден агент не має повної влади над системою  
3) зміни до канонічного стану системи відбуваються лише через proposal lifecycle  
4) людина є фінальною інстанцією в еволюції системи

### 1.2 Чому метод існує

Метод існує для вирішення системних архітектурних проблем:

- **semantic drift**: розходження між реалізацією та каноном
- **loss of architectural integrity** при паралельній роботі агентів
- **неаудитовані мутації** (неможливість відкотити/пояснити зміни)
- **authority inversion** (коли frontend/backend починають “визначати правду”)

### 1.3 Місце в архітектурі

- [[exodus.pp.ua/architecture/ARCHITECTURE_ROOT\|ARCHITECTURE_ROOT]]: задає верхньорівневі аксіоми та “що є системою”.
- [[exodus.pp.ua/architecture/RUNTIME_ARCHITECTURE_CANONICAL\|RUNTIME_ARCHITECTURE_CANONICAL]]: задає операційну архітектуру виконання та межі компонентів.
- Цей документ визначає **метод розвитку** системи (governed evolution) як частину архітектури: хто і як може змінювати канон.

---

## 2. Визначення ролей агентів (архітектурні контракти)

### 2.1 Claude (Principal Architect)

**Роль:** головний архітектор системи.

**Відповідальність:**
- визначає та підтримує канонічну архітектуру (Tier-1 docs)
- формулює інваріанти (див. [[exodus.pp.ua/architecture/KNOWLEDGE_GRAPH_INVARIANTS\|KNOWLEDGE_GRAPH_INVARIANTS]])
- визначає агентну топологію (ролі/межі/контракти)
- задає правила knowledge graph governance та структури документації

**Межі влади (authority boundaries):**
- має право створювати/оновлювати *канонічні архітектурні документи* **лише через proposal lifecycle**
- має право відхиляти/повертати proposals як “architecturally invalid”

**Дозволено змінювати:**
- `docs/architecture/*` (канонічні архітектурні документи) — **тільки через proposal lifecycle**
- архітектурні інваріанти та політики (через proposals)

**Заборонено:**
- напряму змінювати runtime state / storage state, минаючи [[exodus.pp.ua/architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА\|INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]]
- напряму змінювати production реалізацію (frontend/backend) як “source of truth”
- вбудовувати vendor-specific runtime деталі як архітектурний канон (vendor-lock)

---

### 2.2 ChatGPT (Orchestrator)

**Роль:** координатор виконання та інтегратор роботи агентів (execution orchestrator).

**Відповідальність:**
- декомпозиція архітектури в задачі для implementer-агентів
- контроль узгодженості між каноном та реалізацією (alignment checks)
- формування планів робіт/пакетів змін (proposal batches)
- перевірка, що пропоновані зміни не ламають authority model

**Межі влади:**
- не є архітектурним авторитетом
- не затверджує мутації самостійно
- не має write authority до канонічного стану

**Дозволено змінювати:**
- лише **proposals**, “task specs”, коментарі/рекомендації (не канонічний стан)

**Заборонено:**
- редагувати канонічні документи напряму (без proposal lifecycle)
- змінювати інваріанти
- змінювати модель прав доступу (див. [[exodus.pp.ua/architecture/STORAGE_AUTHORITY_MODEL_CANONICAL\|STORAGE_AUTHORITY_MODEL_CANONICAL]])

---

### 2.3 Lovable (Frontend Implementation Agent)

**Роль:** агент реалізації frontend.

**Відповідальність:**
- React UI (projection layer)
- client-side інтеграція з Gateway API
- UI rendering та UX-шари

**Межі влади:**
- frontend є **projection layer**, не source of truth

**Дозволено змінювати:**
- `src/*`, `public/*` (frontend код/ресурси) — згідно з контрактами
- UI, який відображає runtime state та надсилає intent у Gateway

**Заборонено:**
- вводити/зберігати canonical knowledge у frontend
- обходити proposal lifecycle
- робити frontend authoritative щодо state системи

---

### 2.4 Replit Agent (Backend Implementation Agent)

**Роль:** агент реалізації backend/gateway-логіки (implementation).

**Відповідальність:**
- FastAPI backend
- інтеграція з Orchestration (напр., Hatchet як конкретний оркестратор, якщо обрано)
- реалізація Gateway write-gate (перевірки, маршрути, policy enforcement)
- доступ до storage через canonical access layer

**Межі влади:**
- backend реалізує архітектуру, але **не визначає її**
- backend не має права “обійти” proposal систему

**Дозволено змінювати:**
- backend код та конфіг (в межах архітектурних контрактів)
- інтеграційні адаптери orchestration layer (без зміни канону)

**Заборонено:**
- прямі мутації canonical knowledge/state, минаючи proposal lifecycle
- самостійно змінювати authority model або storage semantics
- “підміняти” канонічні правила бізнес-логікою без proposals

---

### 2.5 Runtime knowledge integrity agents

Ці агенти є **контролерами цілісності** та працюють як “governance instrumentation”.

#### 2.5.1 [[graph-linter\|graph-linter]]

**Відповідальність:**
- перевірка структури knowledge graph (wiki-links, вузли/ребра)
- виявлення broken links, orphan docs, відсутніх секцій “Семантичні зв’язки”
- побудова/оновлення похідних індексів (де це дозволено архітектурою)

**Дозволено змінювати:**
- лише дозволені auto-files (якщо визначено каноном), або proposals

**Заборонено:**
- прямі зміни Tier-1 canonical docs
- “виправлення” семантики без proposals

#### 2.5.2 [[semantic-guard\|semantic-guard]]

**Відповідальність:**
- перевірка змін на відповідність [[exodus.pp.ua/architecture/KNOWLEDGE_GRAPH_INVARIANTS\|KNOWLEDGE_GRAPH_INVARIANTS]]
- виявлення суперечностей канону, дублювань, semantic drift

**Дозволено змінювати:**
- нічого напряму; лише генерувати proposals / блокувати pipeline на порушення

**Заборонено:**
- apply мутацій

#### 2.5.3 [[content-router\|content-router]]

**Відповідальність:**
- онбординг нового контенту: класифікація, розміщення, пропозиції link-структури
- формування шаблонів “Семантичні зв’язки” для нових документів

**Дозволено змінювати:**
- нічого напряму; лише proposals

**Заборонено:**
- переміщувати/переписувати канон без proposals

#### 2.5.4 [[tag-auditor\|tag-auditor]]

**Відповідальність:**
- контроль тегів згідно [[exodus.pp.ua/architecture/TAGGING_SYSTEM_CANONICAL\|TAGGING_SYSTEM_CANONICAL]]
- нормалізація/дрейф/узгодженість tag↔wiki-link

**Дозволено змінювати:**
- нічого напряму; лише proposals

**Заборонено:**
- apply мутацій або введення нових тегів поза governance

---

### 2.6 Human Owner

**Роль:** власник системи та фінальна інстанція.

**Відповідальність:**
- фінальне затвердження/відхилення proposals
- визначення стратегічного напряму розвитку
- прийняття архітектурних винятків (якщо вони потрібні)

**Межі влади:**
- має найвищу владу, але діє через формальні механізми (proposals / review)

**Дозволено змінювати:**
- все (включно з каноном), але норма — через proposal lifecycle для auditability

**Заборонено:**
- немає технічних заборон; є **governance-норма**: не ламати provenance.

---

## 3. Модель влади (Authority Model)

### 3.1 Ієрархія архітектурної влади

Норма (обов’язкова):

**Human Owner > Principal Architect (Claude) > Integrity Agents > Implementation Agents**

- Human Owner: фінальний approve/reject.
- Architect: формує канон, інваріанти, правила.
- Integrity Agents: валідація/блокування/пропозиції.
- Implementation Agents: реалізація коду без права визначати канон.

### 3.2 Зв’язок з [[exodus.pp.ua/architecture/STORAGE_AUTHORITY_MODEL_CANONICAL\|STORAGE_AUTHORITY_MODEL_CANONICAL]]

[[exodus.pp.ua/architecture/STORAGE_AUTHORITY_MODEL_CANONICAL\|STORAGE_AUTHORITY_MODEL_CANONICAL]] визначає **права читання/запису** для шарів системи.
Цей документ визначає **процесну** і **рольову** владу над еволюцією канону.

Правило узгодження:
- якщо є конфлікт між ролями в цьому документі та storage-authority правилами — **перемагає [[exodus.pp.ua/architecture/STORAGE_AUTHORITY_MODEL_CANONICAL\|STORAGE_AUTHORITY_MODEL_CANONICAL]]** як write-authority джерело.

### 3.3 Зв’язок з [[exodus.pp.ua/architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА\|INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]]

Proposal система є єдиним механізмом керованої зміни канону:
- агенти створюють proposals
- людина (та/або визначений policy) приймає рішення
- зміни застосовуються контрольовано та відтворювано

---

## 4. Модель мутацій (Mutation Model)

### 4.1 Базова норма

**Жоден агент не модифікує канонічний стан напряму.**

Усі мутації проходять через proposal lifecycle.

### 4.2 Життєвий цикл мутації

Обов’язкові посилання:
- [[exodus.pp.ua/architecture/RUN_LIFECYCLE_CANONICAL\|RUN_LIFECYCLE_CANONICAL]] — як runtime події переходять між станами
- [[exodus.pp.ua/architecture/EXECUTION_PIPELINE_CANONICAL\|EXECUTION_PIPELINE_CANONICAL]] — де виникають proposals та які фази їх породжують
- [[exodus.pp.ua/architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА\|INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]] — state machine proposals та правила consent

---

## 5. Governance knowledge graph

### 5.1 Документація як knowledge graph

Канонічна документація є графом:
- вузли = документи
- ребра = wiki-links `[[...]]`
- кожен Tier-1 документ має секцію “Семантичні зв’язки”

### 5.2 Relationship to [[exodus.pp.ua/architecture/GRAPH_MAP\|GRAPH_MAP]]

[[exodus.pp.ua/architecture/GRAPH_MAP\|GRAPH_MAP]] є центральною картою графа та маршрутом читання.
Цей документ є вузлом Tier-1 governance-кластера і повинен бути відображений у GRAPH_MAP.

### 5.3 Relationship to [[exodus.pp.ua/architecture/KNOWLEDGE_GRAPH_INVARIANTS\|KNOWLEDGE_GRAPH_INVARIANTS]]

Інваріанти визначають машинно-перевірювані правила для:
- структури документації
- authority model
- заборонених мутацій
- консистентності wiki-links та тегів

Цей документ:
- додає набір інваріантів (див. §8), які повинні бути включені в політики перевірки.

### 5.4 Relationship to [[exodus.pp.ua/architecture/TAGGING_SYSTEM_CANONICAL\|TAGGING_SYSTEM_CANONICAL]]

Тегування є частиною governance:
- документ має підтримувати узгодженість з таксономією тегів
- будь-яке додавання/зміна тегів — через proposals

---

## 6. Git як архітектурний субстрат

Git у Garden Bloom є:
- provenance layer (походження знань і змін)
- audit log (історія мутацій)
- version authority для документації
- транспорт для knowledge state (особливо для документів/індексів/похідних артефактів)

Зв’язок з [[exodus.pp.ua/architecture/STORAGE_AUTHORITY_MODEL_CANONICAL\|STORAGE_AUTHORITY_MODEL_CANONICAL]]:
- Git-репозиторій — один із носіїв канонічного стану (залежно від опису в storage-authority моделі),
- але write-path у будь-якому разі має зберігати consent та auditability.

---

## 7. Інтеграція з Orchestration Layer

Зв’язок з [[exodus.pp.ua/architecture/ORCHESTRATION_LAYER_ABSTRACTION\|ORCHESTRATION_LAYER_ABSTRACTION]]:

- orchestration layer відповідає за **тригеринг** агентів та виконання run lifecycle
- агенти можуть генерувати proposals як вихід виконання
- orchestration layer **не** має права застосовувати канонічні мутації без governance

Обов’язкові constraints:
- triggering не дорівнює authority
- execution pipeline не може бути “write bypass”
- кожна мутація канону має provenance та review trail

---

## 8. Safety invariants (machine-checkable)

Нижче наведені інваріанти є **референсними** та повинні бути перевірюваними автоматично (lint/guards).

### INV-MADM-001: No Direct Canonical Writes
Жоден агент не може напряму змінювати Tier-1 canonical docs.
- Усі зміни до `docs/architecture/*` з `tier: 1` мають походити з proposal-apply процесу.

### INV-MADM-002: Frontend Is Not Source of Truth
Frontend (Lovable) не може зберігати/визначати canonical knowledge/state.
- Заборонені патерни: local authoritative state, “truth caches”, rules engine у UI.

### INV-MADM-003: Backend Cannot Bypass Proposal System
Backend (Replit Agent) не може застосовувати мутації knowledge/state, минаючи [[exodus.pp.ua/architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА\|INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]].
- Будь-який write до canonical knowledge має бути результатом approve+apply.

### INV-MADM-004: Integrity Agents Cannot Apply Mutations
[[graph-linter\|graph-linter]], [[semantic-guard\|semantic-guard]], [[content-router\|content-router]], [[tag-auditor\|tag-auditor]] не мають права виконувати apply.
- Вони можуть лише: validate, block, propose.

### INV-MADM-005: Implementation Agents Cannot Redefine Architecture
Lovable та Replit Agent не можуть створювати/оновлювати Tier-1 канон як “архітектурне рішення”.
- Дозволено лише proposals з маркуванням “implementation-alignment”, які вимагають review архітектора/людини.

### INV-MADM-006: Authority Order Must Hold
Під час конфлікту рішень:
Human Owner > Principal Architect > Integrity Agents > Implementation Agents
- Будь-яке автоматичне рішення нижчого рівня не може перекрити рішення вищого.

---

## 9. Семантичні зв'язки

**Цей документ пов’язаний з (мінімальний обов’язковий набір):**
- [[exodus.pp.ua/architecture/ARCHITECTURE_ROOT\|ARCHITECTURE_ROOT]]
- [[exodus.pp.ua/architecture/RUNTIME_ARCHITECTURE_CANONICAL\|RUNTIME_ARCHITECTURE_CANONICAL]]
- [[exodus.pp.ua/architecture/STORAGE_AUTHORITY_MODEL_CANONICAL\|STORAGE_AUTHORITY_MODEL_CANONICAL]]
- [[exodus.pp.ua/architecture/EXECUTION_PIPELINE_CANONICAL\|EXECUTION_PIPELINE_CANONICAL]]
- [[exodus.pp.ua/architecture/INBOX_ТА_PROPOSAL_АРХІТЕКТУРА\|INBOX_ТА_PROPOSAL_АРХІТЕКТУРА]]
- [[exodus.pp.ua/architecture/GRAPH_MAP\|GRAPH_MAP]]
- [[exodus.pp.ua/architecture/KNOWLEDGE_GRAPH_INVARIANTS\|KNOWLEDGE_GRAPH_INVARIANTS]]
- [[exodus.pp.ua/architecture/TAGGING_SYSTEM_CANONICAL\|TAGGING_SYSTEM_CANONICAL]]

**Цей документ деталізує:**
- governance-архітектуру еволюції системи (рольову модель і мутації канону)

**Від цього документа залежать:**
- policy rules для runtime integrity-агентів
- процесні правила для оркестратора (ChatGPT) та implementer-агентів