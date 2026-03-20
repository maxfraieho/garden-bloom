---
tags:
  - domain:runtime
  - domain:integration
  - status:canonical
  - format:spec
  - feature:membridge
  - feature:upgrade
created: 2026-03-15
updated: 2026-03-15
tier: 1
title: "Шлях апгрейду клієнтів Membridge V1"
---

# Шлях апгрейду клієнтів Membridge V1

> Статус: canonical upgrade-path document
> Дата: 2026-03-15
> Scope: перехід membridge clients від поточного стану до unified canonical state
> Авторитет: спирається виключно на канонізовану knowledge base у `./site/notes`

---

## Призначення цього документа

Цей документ є **canonical upgrade-path reference** для membridge clients у системі BLOOM.

Він не вигадує нову архітектуру — він **зводить в один послідовний narrative** вже канонізовані знання з `./site/notes` і описує, як всі вже задокументовані компоненти складаються у реальний шлях апгрейду.

Цей документ є опорною точкою для:
- implementation phases наступного upgrade;
- узгодженого narrative між backend, workflow, bootstrap, memory architecture;
- розуміння різниці між implemented state і target state.

---

## 1. Поточний стан (станом на 2026-03-15)

### Що вже реалізовано і підтверджено

| Компонент | Стан | Джерело |
|-----------|------|---------|
| Protocol V1 E2E | ✅ Підтверджено (2026-02-27) | [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME]] |
| Worker registration | ✅ Виконано | [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME]] |
| Pipeline create→dispatch→heartbeat→complete→artifact | ✅ Виконано | [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME]] |
| GAP-1..GAP-9 | ✅ Всі вирішені | [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME]] |
| Proposal system V1 | ✅ Canonical spec | [[СИСТЕМА_PROPOSAL_V1]] |
| Claude/Codex workflow | ✅ Canonical + hooks | [[canonical-node-state]] |
| ctx / chub / cgc | ✅ Доступні | [[context-bridge]] |
| Skills stack | ✅ Global + project-level | [[runbook-skills-stack-deployment-v1]] |
| Memory architecture | ✅ Задокументовано | [[АРХІТЕКТУРА_ПАМЯТІ]] |
| Obsidian/MinIO sync model | ✅ Canonical spec | [[АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]] |
| Bootstrap profile system | ✅ 6 profiles | [[bootstrap/architecture]] |
| Governance / canonicalization rules | ✅ Зведено | [[ПРИНЦИПИ_КАНОНІЗАЦІЇ_ТА_ОНОВЛЕННЯ_ДОКУМЕНТАЦІЇ_V1]] |

### Що ще не завершено

| Область | Стан | Пріоритет |
|---------|------|-----------|
| Multi-node synchronized context | 🔶 Documented, not deployed | High |
| WebSocket real-time dashboard | 🔶 Planned post-V1 | Medium |
| Memory-aware client (approved read path) | 🔶 Architecture ready, not deployed | High |
| Unified deployment across all nodes | 🔶 Bootstrap exists, rollout incomplete | High |
| Full production rollout of membridge clients | 🔶 Not started | Critical path |
| Backend-integrated proposal lifecycle in clients | 🔶 Spec ready, client-side not implemented | High |

---

## 2. Цільовий стан membridge client

Після завершення upgrade path кожен membridge client node має:

### Workflow layer
- Canonical `claude-codex-workflow` — Claude = architect, Codex = implementer
- `ctx` доступний у `PATH` (`ctx doctor` проходить без помилок)
- `chub` для docs/skills/annotations context
- `cgc` для code context
- Hooks: `unified-skill-hook.sh`, `ctx-workflow-policy.sh` — встановлені та executable
- Skills: global + project-level layers розведені (global: `~/.claude/skills/`, project: `.claude/skills/`)

### Memory layer
- Client читає markdown memory через approved path (Obsidian vault → MinIO → chub)
- **Прямий запис у canonical memory заборонений** з worker-рівня
- Memory updates ідуть через proposals, не через direct write
- Backup retention policy дотримано (`PULL_BACKUP_MAX_DAYS`, `PULL_BACKUP_MAX_COUNT`)
- Leadership model коректний: primary push, secondary pull

### Proposal/apply layer
- Client integrated з BLOOM task envelope (Job → Lease → Proposal → Artifact)
- Result/proposal lifecycle aligned з backend
- Backend залишається single apply authority
- No uncontrolled sync writes

### Bootstrap layer
- Profile-aware deployment (rpi-lowram, arm-sbc, x86-legacy-lowram, cloud-micro, x86-alpine-minimal, generic-safe)
- `doctor.sh` проходить успішно
- Component selection правильний для hardware profile

### Context integrity
- Policy-consistent client state (не допускається drift між nodes)
- Canonical config походить з canonical source repo / source layer
- Planned vs implemented чітко розмежовані

---

## 3. Ролі компонентів у target architecture

### BLOOM Backend
- Single source of truth для Job dispatch і Artifact persistence
- Proposal/apply authority — жоден client не може apply без backend
- Manages worker registration, leases, heartbeats
- REST API → CF Gateway → Replit backend

### Membridge Client
- Worker на кожному node: реєструється, приймає jobs, виконує, повертає artifacts
- **Не** має прямого write до canonical memory
- Синхронізація з MinIO через push lock (primary) / safe-pull backup (secondary)
- Leadership role визначає, хто може push до MinIO

### Claude/Codex Workflow
- Claude = architect, planner, reviewer
- Codex = primary implementer (bulk ops, file changes, commits)
- Governance: `claude-codex-workflow.md` + `codex-usage-policy.md`
- Gate: T1-T5 triggers обов'язково перевіряються до будь-якого bulk task

### ctx / chub / cgc
- `ctx` = unified context bridge (docs + code + routing)
- `chub` = docs/skills/annotations context (Obsidian vault over MinIO)
- `cgc` = code context (repo symbol search)
- Обов'язкові для будь-якого docs або feature task перед Codex delegation

### Obsidian / MinIO / obsidian-mcp
- MinIO = canonical remote storage для memory DB (SQLite) та Obsidian vault snapshots
- Obsidian vault = human-readable markdown memory layer
- obsidian-mcp = Claude gateway до vault (read-only від worker perspective)
- Sync: primary push → MinIO ← secondary pull (з backup)

### User
- Визначає логіку через DRAKON Editor (майбутнє) або proposals
- Не взаємодіє безпосередньо з memory DB
- Бачить стан через dashboard / Artifact results

### Agents / Workers
- Виконують атомарні операції (Job → Lease → complete → Artifact)
- Можуть читати memory через approved path
- Не можуть писати в canonical memory без proposal pipeline

### Bootstrap Layer
- `bloom-node-bootstrap`: profile-aware installer
- Ставить: cgc, chub, workflow hooks, skills
- Перевіряє: `doctor.sh`, `install.sh --verify`
- Canonical source: `claude-codex-workflow` repo (skills/ directory)

### Skills Layer
- Global: `~/.claude/skills/` (GLOBAL_ONLY + PROJECT_REQUIRED installed globally)
- Project: `.claude/skills/` (PROJECT_REQUIRED subset per repo)
- Bootstrap-managed: workflow component встановлює global skills
- Source of truth: `claude-codex-workflow/skills/`

---

## 4. Фази апгрейду

### Phase 0 — Canonical docs and workflow baseline ✅ ВИКОНАНО

**Що зроблено:**
- Docs зведені у `./site/notes` (173 файли, канонізовані)
- Workflow canonicalized (claude-codex-workflow + hooks)
- Bootstrap base created (bloom-node-bootstrap, 6 profiles)
- Memory model documented (DiffMem-inspired, git-based)
- Governance docs: ІНВАРІАНТИ_ГРАФУ_ЗНАНЬ, КАНОНІЗАЦІЯ_МОВИ, ПРИНЦИПИ_КАНОНІЗАЦІЇ
- Skills stack: global + project-level layers розведені
- Protocol V1 E2E підтверджено (2026-02-27)

**Артефакти Phase 0:**
- [[АУДИТ_КАНОНІЧНОСТІ_АКТУАЛЬНОСТІ_ТА_МОВНОЇ_УЗГОДЖЕНОСТІ_ДОКУМЕНТАЦІЇ_V1]]
- [[ПЛАН_ГЛИБОКОЇ_КАНОНІЗАЦІЇ_ТА_ЗМІСТОВОГО_УЗГОДЖЕННЯ_V1]]
- [[runbook-skills-stack-deployment-v1]]
- [[runbook-project-level-skills-v1]]

---

### Phase 1 — Canonical client state 🔶 IN PROGRESS

**Ціль:** кожен node має canonical, verifiable client state.

**Acceptance criteria:**
- `ctx doctor` проходить без помилок (`READY` або `PARTIAL` без critical breaks)
- `~/.claude/hooks/unified-skill-hook.sh` exists and executable
- `~/.claude/hooks/ctx-workflow-policy.sh` exists and executable
- Skills: `using-superpowers`, `verification-before-completion`, `codex` — присутні в `~/.claude/skills/`
- Bootstrap: `doctor.sh` проходить для profile цього node

**Що треба:**
1. Запустити `bloom-node-bootstrap` на кожному target node (`bash install.sh --apply --profile <detected>`)
2. Перевірити canonical node state (`bash doctor.sh`)
3. Верифікувати skill presence (`ls ~/.claude/skills/ | grep -E "codex|verification|superpowers"`)

**Source docs:**
- [[canonical-node-state]] — повний checklist canonical state
- [[bootstrap/architecture]] — component structure
- [[runbook-project-level-skills-v1]] — skill placement model

---

### Phase 2 — Memory-aware client 🔴 NOT STARTED

**Ціль:** client читає markdown memory через approved path; direct write заборонений.

**Acceptance criteria:**
- Client може читати Obsidian vault через `chub` / obsidian-mcp
- Worker **не** пише безпосередньо в `~/.claude-mem/` без pipeline
- Memory updates ідуть через proposal flow
- `ALLOW_SECONDARY_PUSH=0` (default) дотримано
- `LEADERSHIP_ENABLED=1` (default) дотримано

**Що треба:**
1. Перевірити поточний write path у кожному worker script
2. Enforce read-only access до canonical memory від worker context
3. Встановити proposal hook для memory mutations
4. Верифікувати backup retention (`PULL_BACKUP_MAX_DAYS`, `PULL_BACKUP_MAX_COUNT`)

**Source docs:**
- [[АРХІТЕКТУРА_ПАМЯТІ]] — memory subsystem design
- [[РЕЖИМИ_СИНХРОНІЗАЦІЇ_MEMBRIDGE]] — push/pull modes, leadership gates
- [[АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]] — Obsidian/MinIO sync model
- [[ЛІДЕРСТВО_MEMBRIDGE]] — leadership model

---

### Phase 3 — Backend-integrated proposal/apply client 🔴 NOT STARTED

**Ціль:** client integrated з BLOOM task envelope; backend = single apply authority.

**Acceptance criteria:**
- Client відправляє proposals через backend API (`POST /v1/proposals`)
- Worker приймає jobs через Lease mechanism
- Artifacts зберігаються через backend (`POST /v1/artifacts`)
- No direct `apply` на client без backend confirmation
- Job → Lease → heartbeat → complete → Artifact pipeline verified E2E

**Що треба:**
1. Інтегрувати proposal submission у client workflow
2. Перевірити, що client використовує `Authorization: Bearer <OWNER_TOKEN>`
3. Верифікувати lifecycle: `Job.status` transitions правильні
4. E2E test: create proposal → backend apply → artifact available

**Source docs:**
- [[СИСТЕМА_PROPOSAL_V1]] — proposal state machine
- [[КОНТРАКТ_API_ПАМЯТІ]] — memory API contract
- [[JOB_QUEUE_ТА_ARTIFACT_MODEL]] — job queue та artifact model
- [[BLOOM_RUNTIME_MEMBRIDGE_CLAUDE_PROTOCOL_V1]] — client-backend protocol
- [[EXECUTION_PROTOCOL]] — execution protocol

---

### Phase 4 — Multi-node synchronized context 🔴 NOT STARTED

**Ціль:** одна memory model across nodes; MinIO як sync backbone.

**Acceptance criteria:**
- Primary node: push lock + upload до MinIO після кожного значного update
- Secondary nodes: safe-pull з backup перед overwrite
- `cm-doctor` показує `local_ahead: NO` на secondary після sync
- Conflict resolution: leadership handover процедура задокументована та протестована
- No uncontrolled concurrent push від multiple nodes

**Що треба:**
1. Визначити primary node для кожного cluster/project
2. Налаштувати MinIO bucket та credentials на всіх nodes
3. Верифікувати push lock behavior (`LOCK_TTL_SECONDS`, `STALE_LOCK_GRACE_SECONDS`)
4. Протестувати secondary pull з backup
5. Перевірити multi-node scaling на реальних вузлах

**Source docs:**
- [[РЕЖИМИ_СИНХРОНІЗАЦІЇ_MEMBRIDGE]] — push/pull modes, env vars, exit codes
- [[ЛІДЕРСТВО_MEMBRIDGE]] — leadership model
- [[АВТОХАРТБІТ_MEMBRIDGE]] — автоматична синхронізація
- [[ПОСІБНИК_МАСШТАБУВАННЯ_МУЛЬТИВУЗЛОВОГО]] — multi-node scaling guide
- [[ДІАГНОСТИКА_ПАМЯТІ_CLAUDE_ARM64]] — ARM64-specific troubleshooting

---

### Phase 5 — Full production upgrade path 🔴 NOT STARTED

**Ціль:** repeatable, profile-aware rollout з verification і rollback.

**Що треба:**
1. **Rollout strategy:** staged rollout — спочатку одна машина, потім поступово
2. **Migration rules:** backward compat для existing memory DB (SQLite schema migration якщо потрібна)
3. **Profile-specific deployment:** кожен profile (`rpi-lowram`, `arm-sbc`, тощо) має свій tuning
4. **Doctor/verify coverage:** `doctor.sh` покриває всі Phase 1-4 checks
5. **Runbook coverage:** операційні runbooks для кожного recovery scenario
6. **Monitoring:** `cm-doctor`, web UI (`ВЕБ_ІНТЕРФЕЙС_MEMBRIDGE`), heartbeat dashboard

**Source docs:**
- [[RUNBOOK_OBSIDIAN_MINIO_MEMBRIDGE_ВПРОВАДЖЕННЯ_V1]] — deployment runbook
- [[bootstrap/architecture]] — bootstrap component structure
- [[bootstrap/profiles]] — profile system
- [[ПОСІБНИК_МАСШТАБУВАННЯ_МУЛЬТИВУЗЛОВОГО]] — scaling guide
- [[ВЕРИФІКАЦІЯ_ШЛЯХУ_ВИКОНАННЯ_RUNTIME]] — execution path verification

---

## 5. Dependencies і передумови

| Передумова | Стан | Блокує |
|------------|------|--------|
| `./site/notes` knowledge base stable | ✅ | — |
| Workflow docs canonical | ✅ | Phase 1 |
| Bootstrap docs and logic stable | ✅ | Phase 1 |
| Memory model approved | ✅ | Phase 2 |
| Backend proposal/apply sufficiently defined | ✅ | Phase 3 |
| MinIO bucket + credentials available | 🔶 Node-specific | Phase 4 |
| Leadership/conflict rules defined | ✅ | Phase 4 |
| Project/global skill model clear | ✅ | Phase 1 |
| E2E Protocol V1 verified | ✅ | Phase 3 |
| Multi-node hardware available | 🔶 | Phase 4 |

---

## 6. Guardrails

1. **No direct write від membridge workers** до canonical memory без proposal pipeline
2. **No uncontrolled sync writes** — push завжди через leadership gate + push lock
3. **Profile-specific tuning allowed, policy drift forbidden** — кожен node налаштовується, але canonical policy однакова
4. **Canonical config з source repo** — жодних ad-hoc змін без commit до canonical source
5. **Planned vs implemented завжди чітко розмежовані** — не маркувати planned як canonical без верифікації
6. **`./site/notes` = canonical knowledge layer** для цього narrative; не будувати альтернативні джерела істини
7. **Backend = single apply authority** — clients propose, backend applies
8. **`LEADERSHIP_ENABLED=1` by default** — вимикати тільки для isolated testing

---

## 7. Відкриті питання і ризики

### Відкриті питання
- Яка буде SQLite schema migration strategy для existing nodes при Phase 2?
- Як вирішувати conflict між `local_ahead: YES` і leadership handover?
- Чи потрібен окремий MinIO bucket per project, чи shared bucket з prefix?
- Як bootstrap буде верифікувати Phase 2+ requirements (memory-aware state)?
- Чи `doctor.sh` може автоматично виявити leadership drift?

### Ризики

| Ризик | Імовірність | Вплив | Мітигація |
|-------|------------|-------|-----------|
| Memory DB corruption при concurrent push | Low (push lock) | High | Push lock + STALE_LOCK_GRACE |
| Leadership drift між nodes | Medium | High | Regular `cm-doctor` checks |
| Bootstrap profile mismatch | Medium | Medium | `detect.sh` + manual verify |
| Backend availability required for proposals | High dependency | High | Local queue fallback (future) |
| Worker write bypass (security) | Low | Critical | Code audit + proposal enforcement |
| Schema incompatibility при upgrade | Unknown | High | Test upgrade on dev node first |

---

## 8. Конкретні наступні дії

### Immediate (Phase 1 completion)
1. Запустити `bloom-node-bootstrap` на всіх target nodes
2. Верифікувати canonical node state (`bash doctor.sh`) на кожному node
3. Перевірити skills presence і hooks executable
4. Зафіксувати результат у `workflow/canonical-node-state.md` (update status per node)

### Short-term (Phase 2)
1. Провести аудит write paths у всіх worker scripts
2. Enforce read-only flag для canonical memory від worker context
3. Написати proposal hook для memory mutations
4. Верифікувати backup retention на 2+ nodes

### Medium-term (Phase 3)
1. E2E test proposal lifecycle на staging
2. Інтегрувати proposal submission у client workflow scripts
3. Верифікувати Job → Artifact pipeline end-to-end
4. Документувати результат у новому runbook

### For first working membridge client upgrade (Phase 1→2)
1. Pick one node as pilot
2. Run full bootstrap
3. Verify canonical state
4. Enable memory read path via chub
5. Disable direct write (enforce)
6. Run `cm-doctor` + verify backup
7. Document as "first memory-aware client"

---

## Семантичні зв'язки

**Цей документ є частиною:**
- [[АРХІТЕКТУРНИЙ_КОРІНЬ]] — upgrade path як частина архітектурного roadmap

**Цей документ залежить від:**
- [[ПРОГАЛИНИ_ТА_НАСТУПНІ_КРОКИ_RUNTIME]] — current gaps та resolved items
- [[СИСТЕМА_PROPOSAL_V1]] — proposal/apply model
- [[АРХІТЕКТУРА_ПАМЯТІ]] — memory subsystem design
- [[АРХІТЕКТУРА_OBSIDIAN_MINIO_MEMBRIDGE_V1]] — Obsidian/MinIO sync architecture
- [[BLOOM_RUNTIME_MEMBRIDGE_CLAUDE_PROTOCOL_V1]] — client-backend protocol
- [[canonical-node-state]] — canonical node state checklist
- [[context-bridge]] — ctx/chub/cgc context bridge
- [[bootstrap/architecture]] — bootstrap component model
- [[runbook-project-level-skills-v1]] — skills placement model

**Від цього документа залежать:**
- Всі Phase 1-5 implementation plans (майбутні docs)
- Operational runbooks для кожної фази
- `doctor.sh` coverage expansion (Phase 2+ checks)

---

*Canonical upgrade-path document. Спирається на канонізовану knowledge base у `./site/notes`. Не вигадує нової архітектури — зводить вже задокументовані компоненти в послідовну upgrade narrative.*
