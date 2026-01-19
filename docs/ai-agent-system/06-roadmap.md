# 🗺️ Дорожня карта розробки

**Версія**: 1.0 | **Дата**: 2026-01-16

---

## Фази реалізації

```mermaid
gantt
    title AI Agent System Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1 (MVP)
    Task Queue API           :p1a, 2026-01-20, 5d
    Archivist Role           :p1b, after p1a, 5d
    RPi Orchestrator         :p1c, after p1b, 5d
    Frontend Dashboard       :p1d, after p1c, 5d
    
    section Phase 2
    Tech Writer Role         :p2a, after p1d, 5d
    Architect Role           :p2b, after p2a, 5d
    Proposal System          :p2c, after p2b, 5d
    
    section Phase 3
    Editor Role              :p3a, after p2c, 5d
    Replit Backend           :p3b, after p3a, 7d
    Advanced Sync            :p3c, after p3b, 7d
```

---

## Phase 1: MVP (4 тижні)

### Scope
| Компонент | Deliverable | Складність |
|-----------|-------------|------------|
| Worker API | `/agents/tasks`, `/agents/results` | ⭐⭐ |
| Archivist | `summarize`, `synthesize` tasks | ⭐⭐⭐ |
| RPi Orchestrator | Polling + Claude CLI wrapper | ⭐⭐⭐ |
| sqlite-vec | Basic vector search | ⭐⭐ |
| Frontend | Task creation + status view | ⭐⭐ |

### Success Criteria
- [ ] Owner може створити summarize task через UI
- [ ] RPi виконує task і повертає результат
- [ ] Результат відображається як draft

---

## Phase 2: Extended Roles (3 тижні)

### Scope
- Technical Writer role (README, ADR)
- Architect role (diagrams, analysis)
- Proposal system (proactive suggestions)
- Editor role (proofreading)

### Success Criteria
- [ ] 3 активні ролі з унікальними prompts
- [ ] Агент може пропонувати задачі
- [ ] Pipeline виконання (Archivist → Editor)

---

## Phase 3: Cloud Integration (4 тижні)

### Scope
- Replit backend (FastAPI + LanceDB)
- RPi ↔ Replit sync
- Advanced vector search
- Batch processing

---

## Ризики

| Ризик | Ймовірність | Вплив | Mitigation |
|-------|-------------|-------|------------|
| RPi memory overflow | Medium | High | Strict limits, monitoring |
| Claude API costs | Medium | Medium | Prompt caching, budgets |
| Sync conflicts | Low | Medium | Conflict resolution logic |
| Context window limit | Low | Low | RAG chunking |

---

## Оцінка ресурсів

| Ресурс | MVP | Full System |
|--------|-----|-------------|
| Dev time | 4 weeks | 11 weeks |
| Claude API | ~$20/month | ~$40/month |
| Replit Core | $0 (MVP) | ~$7/month |
| Storage | < 1GB | < 5GB |

---

## MVP Priorities

```
1. [MUST] Task Queue API (Worker)
2. [MUST] Archivist role (summarize)
3. [MUST] RPi polling daemon
4. [MUST] Basic UI for task creation
5. [SHOULD] Vector search integration
6. [COULD] Proposal system
```

---

*Документ готовий для review. Наступний крок — узгодження Phase 1 scope та початок імплементації.*
