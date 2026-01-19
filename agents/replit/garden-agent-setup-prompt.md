# 🚀 Replit Agent Prompt: Garden AI Agent Service

**Мета**: Створити Python-сервіс для AI-агента Digital Garden на Replit Core.

---

## КОНТЕКСТ

Ти створюєш backend-сервіс для системи AI-агентів, яка:
- Працює як "інтелектуальний співробітник" для Digital Garden
- Оркеструє задачі між Replit (цей сервіс) та Raspberry Pi (Claude CLI)
- Підтримує ролі: Archivist, Technical Writer, Architect
- Використовує LanceDB для векторного пошуку

**Архітектура**:
```
Cloudflare Worker ←→ Replit (цей сервіс) ←→ RPi Claude CLI
     ↓                      ↓
Digital Garden          LanceDB vectors
```

---

## ТЕХНІЧНІ ВИМОГИ

### Stack
- **Python 3.11+**
- **FastAPI** — REST API
- **LanceDB** — vector database
- **httpx** — async HTTP client
- **Pydantic v2** — data validation
- **sentence-transformers** — embeddings (multilingual model)

### Обмеження
- Replit Core має обмежений RAM — оптимізуй під це
- Не використовуй важкі ML-моделі локально
- RPi виконує inference через Claude CLI, Replit лише оркеструє

---

## СТРУКТУРА ПРОЄКТУ

Створи таку структуру:

```
garden-agent/
├── main.py                 # FastAPI entry point
├── config.py               # Pydantic Settings
├── requirements.txt
│
├── agents/
│   ├── __init__.py
│   ├── base.py             # BaseAgent ABC
│   ├── archivist.py
│   ├── tech_writer.py
│   └── architect.py
│
├── orchestrator/
│   ├── __init__.py
│   ├── router.py           # Task → Agent routing
│   ├── queue.py            # In-memory task queue
│   └── context.py          # Context management
│
├── integrations/
│   ├── __init__.py
│   ├── cloudflare.py       # CF Worker client
│   └── rpi_bridge.py       # RPi communication
│
├── vector/
│   ├── __init__.py
│   └── lancedb_store.py    # Vector operations
│
├── models/
│   ├── __init__.py
│   ├── task.py             # Task, TaskResult
│   └── content.py          # Note, Draft
│
├── prompts/
│   ├── archivist.txt
│   ├── tech_writer.txt
│   └── architect.txt
│
└── utils/
    ├── __init__.py
    ├── tokens.py           # Token utilities
    └── logging.py          # Structured logging
```

---

## КРОК 1: Базова конфігурація

### `requirements.txt`
```
fastapi>=0.109.0
uvicorn[standard]>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
httpx>=0.26.0
lancedb>=0.4.0
sentence-transformers>=2.2.0
python-dotenv>=1.0.0
```

### `config.py`
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Cloudflare Worker
    CF_WORKER_URL: str = ""
    AGENT_API_KEY: str = ""
    
    # RPi
    RPI_SHARED_SECRET: str = ""
    
    # LanceDB
    LANCEDB_PATH: str = "./data/lancedb"
    
    # Agent
    AGENT_MODEL: str = "claude-3-haiku"
    POLL_INTERVAL: int = 30
    
    class Config:
        env_file = ".env"

@lru_cache
def get_settings():
    return Settings()

settings = get_settings()
```

---

## КРОК 2: Data Models

### `models/task.py`
```python
from enum import Enum
from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class TaskType(str, Enum):
    SUMMARIZE = "summarize"
    SYNTHESIZE = "synthesize"
    DOCUMENT = "document"
    README = "readme"
    ADR = "adr"
    DIAGRAM = "diagram"
    ANALYZE = "analyze"

class TaskStatus(str, Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskCreate(BaseModel):
    type: TaskType
    instruction: str
    context: Optional[str] = None
    role: Optional[str] = None
    priority: int = 5

class Task(TaskCreate):
    id: str
    status: TaskStatus = TaskStatus.QUEUED
    created_at: datetime
    executor: Optional[str] = None

class TaskResult(BaseModel):
    task_id: str
    content: str
    status: str = "success"
    metadata: dict = {}
```

---

## КРОК 3: FastAPI Application

### `main.py`
```python
from fastapi import FastAPI, BackgroundTasks, HTTPException
from contextlib import asynccontextmanager
import uvicorn
import uuid
from datetime import datetime

from config import settings
from models.task import TaskCreate, Task, TaskStatus
from orchestrator.queue import TaskQueue
from orchestrator.router import TaskRouter

@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.queue = TaskQueue()
    app.state.router = TaskRouter()
    await app.state.queue.start_polling()
    yield
    await app.state.queue.stop_polling()

app = FastAPI(
    title="Garden AI Agent",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}

@app.post("/tasks")
async def create_task(task_data: TaskCreate, background_tasks: BackgroundTasks):
    task = Task(
        id=f"task_{uuid.uuid4().hex[:8]}",
        created_at=datetime.now(),
        **task_data.model_dump()
    )
    await app.state.queue.enqueue(task)
    background_tasks.add_task(process_task, task.id)
    return {"task_id": task.id, "status": "queued"}

@app.get("/tasks/{task_id}")
async def get_task(task_id: str):
    task = await app.state.queue.get(task_id)
    if not task:
        raise HTTPException(404, "Task not found")
    return task

@app.get("/tasks/pending")
async def pending_tasks(executor: str = "rpi"):
    return {"tasks": await app.state.queue.get_pending(executor)}

@app.post("/webhook/rpi")
async def rpi_result(payload: dict):
    await app.state.queue.complete(
        payload["task_id"],
        payload["result"]
    )
    return {"received": True}

async def process_task(task_id: str):
    task = await app.state.queue.get(task_id)
    if task:
        await app.state.router.execute(task)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## КРОК 4: Task Queue

### `orchestrator/queue.py`
```python
import asyncio
from datetime import datetime
from typing import Dict, Optional, List
from models.task import Task, TaskStatus

class TaskQueue:
    def __init__(self):
        self.tasks: Dict[str, dict] = {}
        self._polling = False
    
    async def enqueue(self, task: Task) -> str:
        self.tasks[task.id] = {
            "task": task,
            "result": None
        }
        return task.id
    
    async def get(self, task_id: str) -> Optional[dict]:
        entry = self.tasks.get(task_id)
        if entry:
            return {
                "id": task_id,
                "status": entry["task"].status.value,
                "result": entry["result"]
            }
        return None
    
    async def get_pending(self, executor: str = "rpi") -> List[dict]:
        pending = []
        for tid, entry in self.tasks.items():
            if entry["task"].status == TaskStatus.QUEUED:
                pending.append({
                    "id": tid,
                    "type": entry["task"].type.value,
                    "instruction": entry["task"].instruction,
                    "context": entry["task"].context,
                    "role": entry["task"].role
                })
        return pending
    
    async def complete(self, task_id: str, result: dict):
        if task_id in self.tasks:
            self.tasks[task_id]["task"].status = TaskStatus.COMPLETED
            self.tasks[task_id]["result"] = result
    
    async def start_polling(self):
        self._polling = True
    
    async def stop_polling(self):
        self._polling = False
```

---

## КРОК 5: Task Router

### `orchestrator/router.py`
```python
from models.task import Task, TaskType
from agents.archivist import ArchivistAgent
from agents.tech_writer import TechWriterAgent
from agents.architect import ArchitectAgent

class TaskRouter:
    def __init__(self):
        self.agents = {
            "archivist": ArchivistAgent(),
            "tech_writer": TechWriterAgent(),
            "architect": ArchitectAgent(),
        }
        
        self.mapping = {
            TaskType.SUMMARIZE: "archivist",
            TaskType.SYNTHESIZE: "archivist",
            TaskType.DOCUMENT: "tech_writer",
            TaskType.README: "tech_writer",
            TaskType.ADR: "tech_writer",
            TaskType.DIAGRAM: "architect",
            TaskType.ANALYZE: "architect",
        }
    
    def get_agent(self, task: Task):
        agent_name = task.role or self.mapping.get(task.type, "archivist")
        return self.agents.get(agent_name)
    
    async def execute(self, task: Task):
        agent = self.get_agent(task)
        if agent:
            return await agent.execute(task)
```

---

## КРОК 6: Base Agent

### `agents/base.py`
```python
from abc import ABC, abstractmethod
from pathlib import Path
from models.task import Task, TaskResult

class BaseAgent(ABC):
    role: str = "base"
    max_tokens: int = 4000
    
    @property
    def system_prompt(self) -> str:
        path = Path(f"prompts/{self.role}.txt")
        if path.exists():
            return path.read_text()
        return f"You are a helpful {self.role} agent."
    
    @abstractmethod
    async def execute(self, task: Task) -> TaskResult:
        pass
    
    def build_messages(self, task: Task) -> list:
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": f"{task.instruction}\n\n{task.context or ''}"}
        ]
```

### `agents/archivist.py`
```python
from agents.base import BaseAgent
from models.task import Task, TaskResult

class ArchivistAgent(BaseAgent):
    role = "archivist"
    
    async def execute(self, task: Task) -> TaskResult:
        # Делегуємо до RPi через polling
        # RPi забере задачу через /tasks/pending
        return TaskResult(
            task_id=task.id,
            content="",
            status="delegated_to_rpi"
        )
```

---

## КРОК 7: System Prompts

### `prompts/archivist.txt`
```
Ти — Архіваріус Digital Garden.

ОБОВ'ЯЗКИ:
- Створювати короткі, точні резюме
- Синтезувати пов'язані нотатки в есе
- Виділяти ключові ідеї та зв'язки

ФОРМАТ:
- Заголовок з emoji
- Короткий вступ (1-2 речення)
- Основний зміст
- Теги (якщо доречно)

СТИЛЬ:
- Академічний, але доступний
- Українська мова
- Англійські технічні терміни
```

### `prompts/tech_writer.txt`
```
Ти — Технічний Письменник Digital Garden.

ОБОВ'ЯЗКИ:
- README файли
- ADR (Architecture Decision Records)
- Технічна документація

ФОРМАТ:
- Markdown
- Чіткі секції
- Приклади коду
- Mermaid-діаграми де доречно

СТИЛЬ:
- Інженерний, без маркетингу
- Практичний
- Українська + англ. терміни
```

### `prompts/architect.txt`
```
Ти — Архітектор Digital Garden.

ОБОВ'ЯЗКИ:
- Аналіз архітектури систем
- Mermaid-діаграми (C4, sequence, flowchart)
- Рекомендації по дизайну

ФОРМАТ:
- Текстовий аналіз
- Діаграми в Mermaid
- Таблиці порівнянь

СТИЛЬ:
- Системне мислення
- Конкретні рекомендації
- Trade-off аналіз
```

---

## СЕКРЕТИ (Replit Secrets)

Додай у Replit Secrets:

| Key | Value |
|-----|-------|
| `CF_WORKER_URL` | URL твого Cloudflare Worker |
| `AGENT_API_KEY` | Shared secret для автентифікації |
| `RPI_SHARED_SECRET` | Secret для RPi webhook |

---

## ТЕСТУВАННЯ

Після створення:

```bash
# Запуск
python main.py

# Тест health
curl http://localhost:8000/health

# Створити задачу
curl -X POST http://localhost:8000/tasks \
  -H "Content-Type: application/json" \
  -d '{"type": "summarize", "instruction": "Summarize this", "context": "Test content"}'

# Перевірити pending
curl http://localhost:8000/tasks/pending
```

---

## НАСТУПНІ КРОКИ

1. ✅ Базовий FastAPI сервіс
2. ⬜ LanceDB інтеграція
3. ⬜ Cloudflare Worker клієнт
4. ⬜ RPi bridge з fallback
5. ⬜ Background polling

---

**Почни з базової структури та `main.py`. Потім додавай модулі поступово.**
