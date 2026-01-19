# 🐍 Реалізація на Replit Core

**Версія**: 1.0 | **Дата**: 2026-01-16

---

## Структура Python-проєкту

```
garden-agent/
├── main.py                 # Entry point, FastAPI app
├── config.py               # Environment configuration
├── requirements.txt        # Dependencies
│
├── agents/
│   ├── __init__.py
│   ├── base.py             # BaseAgent abstract class
│   ├── archivist.py        # Archivist role implementation
│   ├── tech_writer.py      # Technical Writer role
│   └── architect.py        # Architect role
│
├── orchestrator/
│   ├── __init__.py
│   ├── router.py           # Task routing logic
│   ├── queue.py            # Task queue management
│   └── context.py          # Context management utilities
│
├── integrations/
│   ├── __init__.py
│   ├── cloudflare.py       # Cloudflare Worker API client
│   ├── rpi_bridge.py       # RPi Claude CLI communication
│   └── garden.py           # Digital Garden content operations
│
├── vector/
│   ├── __init__.py
│   ├── lancedb_store.py    # LanceDB vector operations
│   └── embeddings.py       # Embedding generation
│
├── models/
│   ├── __init__.py
│   ├── task.py             # Task data models
│   ├── agent.py            # Agent configuration models
│   └── content.py          # Content/note models
│
├── prompts/
│   ├── archivist.txt       # Archivist system prompt
│   ├── tech_writer.txt     # Tech Writer system prompt
│   └── architect.txt       # Architect system prompt
│
├── utils/
│   ├── __init__.py
│   ├── tokens.py           # Token counting/optimization
│   ├── cache.py            # Prompt caching utilities
│   └── logging.py          # Structured logging
│
└── tests/
    ├── __init__.py
    ├── test_agents.py
    ├── test_orchestrator.py
    └── test_integrations.py
```

---

## Ключові модулі

### 1. Entry Point (`main.py`)

```python
"""
Garden Agent - AI Agent Service for Digital Garden
Runs on Replit Core, orchestrates AI tasks
"""
from fastapi import FastAPI, BackgroundTasks
from contextlib import asynccontextmanager
import uvicorn

from config import settings
from orchestrator.router import TaskRouter
from orchestrator.queue import TaskQueue
from integrations.cloudflare import CloudflareClient

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    app.state.task_queue = TaskQueue()
    app.state.router = TaskRouter()
    app.state.cf_client = CloudflareClient(settings.CF_WORKER_URL)
    
    # Start background polling
    await app.state.task_queue.start_polling()
    
    yield
    
    # Shutdown
    await app.state.task_queue.stop_polling()

app = FastAPI(
    title="Garden Agent",
    version="1.0.0",
    lifespan=lifespan
)

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/tasks")
async def create_task(task: TaskCreate, background_tasks: BackgroundTasks):
    """Create a new task for AI agent processing"""
    task_id = await app.state.task_queue.enqueue(task)
    background_tasks.add_task(process_task, task_id)
    return {"task_id": task_id, "status": "queued"}

@app.get("/tasks/{task_id}")
async def get_task(task_id: str):
    """Get task status and result"""
    return await app.state.task_queue.get(task_id)

@app.post("/webhook/rpi")
async def rpi_webhook(payload: RPiResult):
    """Receive results from RPi Claude CLI"""
    await app.state.router.handle_rpi_result(payload)
    return {"received": True}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

### 2. Base Agent (`agents/base.py`)

```python
"""
Abstract base class for all AI agent roles
"""
from abc import ABC, abstractmethod
from typing import Optional
from pydantic import BaseModel

from models.task import Task, TaskResult
from utils.tokens import count_tokens, truncate_context

class AgentConfig(BaseModel):
    role: str
    max_input_tokens: int = 8000
    max_output_tokens: int = 4000
    temperature: float = 0.7
    use_cache: bool = True

class BaseAgent(ABC):
    def __init__(self, config: AgentConfig):
        self.config = config
        self._system_prompt: Optional[str] = None
    
    @property
    def system_prompt(self) -> str:
        if self._system_prompt is None:
            self._system_prompt = self._load_prompt()
        return self._system_prompt
    
    def _load_prompt(self) -> str:
        """Load system prompt from file"""
        with open(f"prompts/{self.config.role}.txt") as f:
            return f.read()
    
    @abstractmethod
    async def execute(self, task: Task) -> TaskResult:
        """Execute the task and return result"""
        pass
    
    def prepare_context(self, task: Task, max_tokens: int) -> str:
        """Prepare context within token limits"""
        context = task.context or ""
        current_tokens = count_tokens(context)
        
        if current_tokens > max_tokens:
            context = truncate_context(context, max_tokens)
        
        return context
    
    def build_messages(self, task: Task) -> list[dict]:
        """Build message array for LLM call"""
        context = self.prepare_context(task, self.config.max_input_tokens)
        
        return [
            {"role": "system", "content": self.system_prompt},
            {"role": "user", "content": f"{task.instruction}\n\n---\n\n{context}"}
        ]
```

### 3. Archivist Implementation (`agents/archivist.py`)

```python
"""
Archivist Agent - Summarization and synthesis
"""
from agents.base import BaseAgent, AgentConfig
from models.task import Task, TaskResult
from integrations.rpi_bridge import RPiBridge

class ArchivistAgent(BaseAgent):
    def __init__(self):
        super().__init__(AgentConfig(
            role="archivist",
            max_input_tokens=6000,  # Conservative for RPi
            max_output_tokens=2000,
            temperature=0.5
        ))
        self.rpi = RPiBridge()
    
    async def execute(self, task: Task) -> TaskResult:
        """Execute archivist task via RPi Claude CLI"""
        messages = self.build_messages(task)
        
        # Delegate to RPi for inference
        if await self.rpi.is_available():
            result = await self.rpi.execute(
                messages=messages,
                cache_key=f"archivist_{task.id}"
            )
        else:
            # Fallback: use Replit-hosted model or queue for later
            result = await self._fallback_execute(messages)
        
        return TaskResult(
            task_id=task.id,
            content=result.content,
            metadata={
                "tokens_used": result.tokens,
                "cached": result.from_cache,
                "executor": "rpi" if result.from_rpi else "replit"
            }
        )
    
    async def summarize(self, notes: list[str], style: str = "brief") -> str:
        """Summarize multiple notes"""
        task = Task(
            type="summarize",
            instruction=f"Створи {style} резюме наступних нотаток:",
            context="\n\n---\n\n".join(notes)
        )
        result = await self.execute(task)
        return result.content
    
    async def synthesize(self, notes: list[str], theme: str) -> str:
        """Synthesize notes into coherent essay"""
        task = Task(
            type="synthesize",
            instruction=f"Синтезуй ці нотатки в есе на тему: {theme}",
            context="\n\n---\n\n".join(notes)
        )
        result = await self.execute(task)
        return result.content
```

### 4. Task Router (`orchestrator/router.py`)

```python
"""
Task routing and orchestration
"""
from typing import Dict, Type
from models.task import Task, TaskType
from agents.base import BaseAgent
from agents.archivist import ArchivistAgent
from agents.tech_writer import TechWriterAgent
from agents.architect import ArchitectAgent

class TaskRouter:
    def __init__(self):
        self.agents: Dict[str, BaseAgent] = {
            "archivist": ArchivistAgent(),
            "tech_writer": TechWriterAgent(),
            "architect": ArchitectAgent(),
        }
        
        self.task_mapping: Dict[TaskType, str] = {
            TaskType.SUMMARIZE: "archivist",
            TaskType.SYNTHESIZE: "archivist",
            TaskType.DOCUMENT: "tech_writer",
            TaskType.README: "tech_writer",
            TaskType.ADR: "tech_writer",
            TaskType.DIAGRAM: "architect",
            TaskType.ANALYZE: "architect",
        }
    
    def route(self, task: Task) -> BaseAgent:
        """Route task to appropriate agent"""
        agent_name = self.task_mapping.get(task.type)
        
        if not agent_name:
            raise ValueError(f"Unknown task type: {task.type}")
        
        return self.agents[agent_name]
    
    async def execute(self, task: Task):
        """Route and execute task"""
        agent = self.route(task)
        return await agent.execute(task)
    
    async def handle_rpi_result(self, payload):
        """Handle result received from RPi webhook"""
        task_id = payload.task_id
        # Update task status and store result
        await self.task_queue.complete(task_id, payload.result)
```

### 5. Cloudflare Integration (`integrations/cloudflare.py`)

```python
"""
Cloudflare Worker API client
"""
import httpx
from typing import Optional
from config import settings

class CloudflareClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={"X-Agent-Key": settings.AGENT_API_KEY}
        )
    
    async def get_notes(self, tag: Optional[str] = None) -> list[dict]:
        """Fetch notes from Digital Garden"""
        params = {"tag": tag} if tag else {}
        response = await self.client.get(
            f"{self.base_url}/api/notes",
            params=params
        )
        response.raise_for_status()
        return response.json()["notes"]
    
    async def submit_draft(self, content: str, metadata: dict) -> dict:
        """Submit agent-generated content as draft"""
        response = await self.client.post(
            f"{self.base_url}/api/agents/drafts",
            json={
                "content": content,
                "metadata": metadata,
                "author": {
                    "type": "ai-agent",
                    "agentModel": settings.AGENT_MODEL,
                    "role": metadata.get("role", "unknown")
                }
            }
        )
        response.raise_for_status()
        return response.json()
    
    async def get_pending_tasks(self) -> list[dict]:
        """Poll for pending tasks from Worker"""
        response = await self.client.get(
            f"{self.base_url}/api/agents/tasks"
        )
        response.raise_for_status()
        return response.json()["tasks"]
    
    async def submit_result(self, task_id: str, result: dict) -> dict:
        """Submit task result back to Worker"""
        response = await self.client.post(
            f"{self.base_url}/api/agents/results",
            json={"task_id": task_id, "result": result}
        )
        response.raise_for_status()
        return response.json()
```

### 6. Vector Store (`vector/lancedb_store.py`)

```python
"""
LanceDB vector storage for semantic search
"""
import lancedb
from sentence_transformers import SentenceTransformer
from config import settings

class VectorStore:
    def __init__(self):
        self.db = lancedb.connect(settings.LANCEDB_PATH)
        self.encoder = SentenceTransformer(
            "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
        )
        self._ensure_table()
    
    def _ensure_table(self):
        """Create notes table if not exists"""
        if "notes" not in self.db.table_names():
            self.db.create_table("notes", schema={
                "id": "string",
                "title": "string",
                "content": "string",
                "vector": "vector[384]",
                "tags": "list<string>",
                "updated_at": "timestamp"
            })
    
    def embed(self, text: str) -> list[float]:
        """Generate embedding for text"""
        return self.encoder.encode(text).tolist()
    
    async def upsert(self, note: dict):
        """Insert or update note with embedding"""
        table = self.db.open_table("notes")
        
        vector = self.embed(f"{note['title']}\n{note['content']}")
        
        table.add([{
            "id": note["id"],
            "title": note["title"],
            "content": note["content"],
            "vector": vector,
            "tags": note.get("tags", []),
            "updated_at": note.get("updated_at")
        }])
    
    async def search(self, query: str, limit: int = 5) -> list[dict]:
        """Semantic search for relevant notes"""
        table = self.db.open_table("notes")
        query_vector = self.embed(query)
        
        results = table.search(query_vector).limit(limit).to_list()
        
        return [{
            "id": r["id"],
            "title": r["title"],
            "content": r["content"],
            "score": r["_distance"]
        } for r in results]
```

---

## Конфігурація та секрети

### `config.py`

```python
"""
Environment configuration using Pydantic Settings
"""
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Cloudflare Worker
    CF_WORKER_URL: str
    AGENT_API_KEY: str
    
    # RPi Bridge
    RPI_WEBHOOK_URL: str = ""
    RPI_SHARED_SECRET: str
    
    # LanceDB
    LANCEDB_PATH: str = "./data/lancedb"
    
    # Agent configuration
    AGENT_MODEL: str = "claude-3-haiku"
    MAX_CONCURRENT_TASKS: int = 3
    TASK_TIMEOUT_SECONDS: int = 300
    
    # Polling
    POLL_INTERVAL_SECONDS: int = 30
    
    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()

settings = get_settings()
```

### Replit Secrets

В Replit Dashboard → Secrets:

| Key | Description |
|-----|-------------|
| `CF_WORKER_URL` | `https://garden-mcp.your-domain.workers.dev` |
| `AGENT_API_KEY` | Shared secret for Worker auth |
| `RPI_SHARED_SECRET` | Secret for RPi webhook verification |
| `RPI_WEBHOOK_URL` | Optional: RPi callback URL |

---

## Фонові задачі

### Task Queue (`orchestrator/queue.py`)

```python
"""
Simple in-memory task queue with background polling
"""
import asyncio
from datetime import datetime
from typing import Dict, Optional
from enum import Enum

class TaskStatus(Enum):
    QUEUED = "queued"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"

class TaskQueue:
    def __init__(self):
        self.tasks: Dict[str, dict] = {}
        self._polling = False
        self._poll_task: Optional[asyncio.Task] = None
    
    async def enqueue(self, task_data: dict) -> str:
        """Add task to queue"""
        task_id = f"task_{datetime.now().timestamp()}"
        self.tasks[task_id] = {
            "id": task_id,
            "status": TaskStatus.QUEUED,
            "data": task_data,
            "created_at": datetime.now(),
            "result": None
        }
        return task_id
    
    async def get(self, task_id: str) -> Optional[dict]:
        """Get task by ID"""
        return self.tasks.get(task_id)
    
    async def complete(self, task_id: str, result: dict):
        """Mark task as completed with result"""
        if task_id in self.tasks:
            self.tasks[task_id]["status"] = TaskStatus.COMPLETED
            self.tasks[task_id]["result"] = result
            self.tasks[task_id]["completed_at"] = datetime.now()
    
    async def start_polling(self):
        """Start background polling for external tasks"""
        self._polling = True
        self._poll_task = asyncio.create_task(self._poll_loop())
    
    async def stop_polling(self):
        """Stop background polling"""
        self._polling = False
        if self._poll_task:
            self._poll_task.cancel()
    
    async def _poll_loop(self):
        """Poll Cloudflare Worker for pending tasks"""
        from integrations.cloudflare import CloudflareClient
        from config import settings
        
        client = CloudflareClient(settings.CF_WORKER_URL)
        
        while self._polling:
            try:
                tasks = await client.get_pending_tasks()
                for task in tasks:
                    await self.enqueue(task)
            except Exception as e:
                print(f"Polling error: {e}")
            
            await asyncio.sleep(settings.POLL_INTERVAL_SECONDS)
```

---

## Залежності (`requirements.txt`)

```
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.5.0
pydantic-settings>=2.1.0
httpx>=0.26.0
lancedb>=0.4.0
sentence-transformers>=2.2.0
python-dotenv>=1.0.0
pytest>=7.4.0
pytest-asyncio>=0.23.0
```

---

## Деплой на Replit

### `.replit`

```toml
run = "python main.py"
language = "python3"

[nix]
channel = "stable-23_11"

[deployment]
run = ["sh", "-c", "python main.py"]
deploymentTarget = "cloudrun"

[env]
PYTHONPATH = "${REPL_HOME}"
```

### `replit.nix`

```nix
{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
  ];
}
```

---

## Моніторинг та логування

```python
# utils/logging.py
import logging
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
    
    def log(self, level: str, message: str, **kwargs):
        entry = {
            "timestamp": datetime.now().isoformat(),
            "level": level,
            "message": message,
            **kwargs
        }
        self.logger.log(
            getattr(logging, level.upper()),
            json.dumps(entry)
        )
    
    def task_started(self, task_id: str, task_type: str, agent: str):
        self.log("info", "Task started", 
                 task_id=task_id, type=task_type, agent=agent)
    
    def task_completed(self, task_id: str, tokens: int, duration_ms: int):
        self.log("info", "Task completed",
                 task_id=task_id, tokens=tokens, duration_ms=duration_ms)
```

---

*Готово до імплементації. Наступний крок — створення репозиторію на Replit та налаштування секретів.*
