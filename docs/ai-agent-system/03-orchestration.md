# 🔄 Оркестрація та Workflow

**Версія**: 1.0 | **Дата**: 2026-01-16

---

## 1. Orchestrator Architecture

```mermaid
graph TB
    subgraph "Task Input"
        UI[Owner UI]
        Proposal[Agent Proposal]
        Schedule[Scheduled Task]
    end
    
    subgraph "Orchestrator (Python on RPi)"
        Router{Task Router}
        Queue[Task Queue]
        State[State Manager]
    end
    
    subgraph "Role Execution"
        Arch[Archivist]
        TW[Tech Writer]
        Arc[Architect]
    end
    
    UI --> Router
    Proposal --> Router
    Schedule --> Router
    Router --> Queue
    Queue --> State
    State --> Arch
    State --> TW
    State --> Arc
```

## 2. Чи потрібен центральний Orchestrator?

**Рішення: ТАК**, але мінімалістичний.

| Підхід | Pros | Cons | Рішення |
|--------|------|------|---------|
| Без orchestrator | Простіше | Немає координації ролей | ❌ |
| Повний orchestrator (LLM) | Гнучкий | Дорого, повільно | ❌ |
| **Lightweight (Python)** | Швидко, дешево, контрольовано | Менш гнучкий | ✅ |

## 3. Маршрутизація задач

```python
# orchestrator/router.py
TASK_ROUTING = {
    # action → role mapping
    "summarize": "archivist",
    "synthesize": "archivist",
    "digest": "archivist",
    "readme": "technical_writer",
    "adr": "technical_writer",
    "api_docs": "technical_writer",
    "analyze": "architect",
    "design": "architect",
    "diagram": "architect",
}

def route_task(task: AgentTask) -> str:
    """Визначає роль для задачі"""
    return TASK_ROUTING.get(task.action, "archivist")
```

## 4. Обмін контекстом між ролями

```mermaid
sequenceDiagram
    participant O as Orchestrator
    participant A as Archivist
    participant E as Editor
    participant S as State Store
    
    O->>A: Execute(synthesize, notes)
    A->>S: Save(draft_essay)
    A-->>O: Complete(draft_id)
    
    O->>S: Load(draft_id)
    S-->>O: draft_essay
    
    O->>E: Execute(proofread, draft_essay)
    E->>S: Save(polished_essay)
    E-->>O: Complete(polished_id)
```

## 5. Зберігання результатів

```
workflow:
  1. Agent генерує результат
  2. Результат → Cloudflare Worker API
  3. Worker зберігає в MinIO (content) + KV (metadata)
  4. Результат з'являється як "draft" в Digital Garden
  5. Owner переглядає → Approve → Published
```

## 6. Агент як "Співробітник"

| Традиційний API | Агент-Співробітник |
|-----------------|-------------------|
| Запит → Відповідь | Задача → Пропозиція → Схвалення → Виконання |
| Немає ініціативи | Може пропонувати задачі |
| Одноразова взаємодія | Контекст та історія |
| Немає state | Памʼятає попередні взаємодії |

---

## Наступний документ

→ [04-replit-implementation.md](./04-replit-implementation.md)
