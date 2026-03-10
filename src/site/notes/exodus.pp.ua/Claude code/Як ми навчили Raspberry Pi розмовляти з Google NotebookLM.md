---
{"title":"NotebookLM MCP + Claude Code на Raspberry Pi (повний практичний мануал)","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/Claude code/Як ми навчили Raspberry Pi розмовляти з Google NotebookLM/","dgPassFrontmatter":true,"noteIcon":""}
---


> *Або: від "кукі протухли знову" до ChatGPT що читає ваші ноутбуки — за один вечір*

**Дата:** 2026-03-04  
**Теги:** #notebooklm #mcp #raspberry-pi #python #ai-agents #automation #chatgpt

---

## Що таке Google NotebookLM і навіщо його автоматизувати

Google NotebookLM — дослідницький інструмент на базі Gemini. Ви завантажуєте документи, статті, PDF, відео з YouTube — і отримуєте AI-асистента який **знає тільки те що ви йому дали**. Ніяких галюцинацій з інтернету, тільки ваші джерела.

Що вміє:
- відповідати на запитання по документах
- генерувати подкасти (Audio Overview) з ваших матеріалів
- створювати квізи, флеш-картки, mind-map'и, звіти
- запускати web-дослідження і автоматично додавати джерела

Проблема одна — **офіційного API не існує**. Google не відкрив NotebookLM для розробників. Все що є — внутрішні RPC ендпоінти які використовує веб-інтерфейс.

---

## notebooklm-py — бібліотека яка цього не боїться

**Репо:** [github.com/teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py)  
**PyPI:** `pip install notebooklm-py`  
**Версія:** 0.3.3

`notebooklm-py` — reverse-engineered клієнт для NotebookLM. Бібліотека запускає Playwright (headless Chromium), логіниться у ваш Google акаунт і спілкується з внутрішніми RPC методами від вашого імені.

> ⚠️ Неофіційна бібліотека. Google може змінити API без попередження. Для прототипів і особистих проєктів.

### Що вміє

| Категорія | Можливості |
|-----------|-----------|
| Notebooks | create, list, rename, delete, share |
| Sources | URL, YouTube, PDF, TXT, MD, DOCX, Google Drive, текст |
| Chat | запитання, історія розмови, кастомні персони |
| Генерація | подкаст, відео, слайди, квіз, флеш-картки, звіт, mind-map |
| Дослідження | web-агент і Drive-агент з автоімпортом |
| Завантаження | аудіо, відео, слайди, інфографіка, квізи, таблиці |

---

## Встановлення

### Через pipx (рекомендовано для серверів)

`pipx` ізолює кожен CLI-інструмент у власному venv — не забруднює системний Python:

```bash
pipx install "notebooklm-py[browser]"
notebooklm --version
# NotebookLM CLI, version 0.3.3
```

### Playwright у pipx-venv

Якщо встановили через pipx, Playwright треба додати саме в той venv:

```bash
pipx inject notebooklm-py playwright
/home/vokov/.local/pipx/venvs/notebooklm-py/bin/playwright install chromium
```

---

## Авторизація на headless сервері

Google не надає токенів для стороннього ПЗ. Єдиний спосіб — зайти як реальний користувач через браузер.

На сервері без екрана (Raspberry Pi, VPS) це неможливо напряму. Рішення — **авторизуватися на локальній машині і перенести сесію**.

### На ноутбуці

```bash
pip install "notebooklm-py[browser]"
playwright install chromium
notebooklm login
# → відкриється браузер, логінитесь Google
# → сесія зберігається у ~/.notebooklm/storage_state.json
```

### Копіюємо сесію на Pi

```bash
ssh vokov@rpi4b "mkdir -p ~/.notebooklm"
scp ~/.notebooklm/storage_state.json vokov@rpi4b:~/.notebooklm/storage_state.json
```

### Перевірка на Pi

```bash
notebooklm list
# ┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┓
# ┃ Title              ┃ ID             ┃
# ┡━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━┩
# │ Globalisation 1997 │ abc123...      │
# └────────────────────┴────────────────┘
```

**Чому сесія не протухає?** `notebooklm-py` зберігає повний `storage_state` — cookies, `localStorage` і всі токени. При кожному виклику стан оновлюється автоматично.

---

## Python API

```python
import asyncio
from notebooklm import NotebookLMClient

async def main():
    async with await NotebookLMClient.from_storage() as client:

        # Список ноутбуків
        notebooks = await client.notebooks.list()
        for nb in notebooks:
            print(f"{nb.title}: {nb.id}")

        # Створити новий
        nb = await client.notebooks.create("Моє дослідження")

        # Додати джерело
        await client.sources.add_url(
            nb.id,
            "https://en.wikipedia.org/wiki/Globalisation"
        )

        # Запитання
        result = await client.chat.ask(nb.id, "Основні висновки?")
        print(result.answer)

        # Генерація подкасту — повертає одразу, не чекати!
        status = await client.artifacts.generate_audio(nb.id)
        print(f"task_id={status.task_id}")
        # ⚠️ Може тривати 30+ хвилин

asyncio.run(main())
```

---

## CLI

```bash
notebooklm use <notebook_id>

# Джерела
notebooklm source add "https://arxiv.org/abs/2301.00001"
notebooklm source add "./paper.pdf"

# Запитання
notebooklm ask "Основні висновки?"
notebooklm ask "Summarize" --notebook abc123 --json

# Генерація
notebooklm generate audio
notebooklm generate quiz --difficulty hard
notebooklm generate flashcards --quantity more
notebooklm generate mind-map

# Завантаження
notebooklm download audio ./podcast.mp3
notebooklm download quiz --format markdown ./quiz.md
```

---

## Agent Skills для Claude Code і Codex

### Claude Code

```bash
notebooklm skill install
# Кладе SKILL.md у ~/.claude/skills/notebooklm/
```

Після цього Claude Code розуміє природньомовні команди:
```
Create a podcast about quantum computing from my notes
List all my notebooks
```

### OpenAI Codex

Codex читає skills з `~/.codex/skills/`. Копіюємо той самий файл:

```bash
mkdir -p ~/.codex/skills/notebooklm
cp ~/.claude/skills/notebooklm/SKILL.md ~/.codex/skills/notebooklm/SKILL.md
```

---

## MCP сервер — підключаємо ChatGPT

MCP (Model Context Protocol) — стандарт від Anthropic для підключення зовнішніх інструментів до LLM агентів. ChatGPT, Claude, Codex і будь-який інший агент з підтримкою MCP може викликати наші "tools" через HTTP.

### Встановлення FastMCP

```bash
/home/vokov/.local/pipx/venvs/notebooklm-py/bin/pip install fastmcp
```

### Сервер (`/home/vokov/notebooklm_mcp_server.py`)

```python
from fastmcp import FastMCP
from notebooklm import NotebookLMClient

mcp = FastMCP("notebooklm")

async def get_client():
    return await NotebookLMClient.from_storage()

@mcp.tool()
async def list_notebooks() -> list:
    """List all NotebookLM notebooks"""
    async with await get_client() as client:
        notebooks = await client.notebooks.list()
        return [{"id": nb.id, "title": nb.title} for nb in notebooks]

@mcp.tool()
async def ask(notebook_id: str, question: str) -> str:
    """Ask a question to a specific notebook"""
    async with await get_client() as client:
        result = await client.chat.ask(notebook_id, question)
        return result.answer

@mcp.tool()
async def add_source_url(notebook_id: str, url: str) -> dict:
    """Add a URL source to a notebook"""
    async with await get_client() as client:
        source = await client.sources.add_url(notebook_id, url)
        return {"source_id": source.id, "title": source.title}

@mcp.tool()
async def create_notebook(title: str) -> dict:
    """Create a new notebook"""
    async with await get_client() as client:
        nb = await client.notebooks.create(title)
        return {"id": nb.id, "title": nb.title}

@mcp.tool()
async def generate_audio(notebook_id: str) -> dict:
    """Start podcast generation — returns immediately, do NOT wait"""
    async with await get_client() as client:
        status = await client.artifacts.generate_audio(notebook_id)
        return {"task_id": status.task_id, "status": "started"}

@mcp.tool()
async def list_artifacts(notebook_id: str) -> list:
    """List generated artifacts for a notebook"""
    async with await get_client() as client:
        artifacts = await client.artifacts.list(notebook_id)
        return [{"id": a.id, "kind": str(a.kind), "status": str(a.status)}
                for a in artifacts]

if __name__ == "__main__":
    # Streamable HTTP — єдиний транспорт що працює з ChatGPT
    mcp.run(transport="streamable-http", host="0.0.0.0", port=8002)
```

> ⚠️ **Критично:** ChatGPT використовує Streamable HTTP, **не** SSE. `transport="sse"` — ChatGPT зависатиме при підключенні ініколи не з'єднається. Тільки `transport="streamable-http"`.

### Перевірка сервера

```bash
# Має повернути protocolVersion і список capabilities
curl -X POST http://localhost:8002/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'
```

### Systemd сервіс

```ini
# /etc/systemd/system/notebooklm-mcp.service
[Unit]
Description=NotebookLM MCP Server
After=network.target

[Service]
ExecStart=/home/vokov/.local/pipx/venvs/notebooklm-py/bin/python \
          /home/vokov/notebooklm_mcp_server.py
Restart=on-failure
User=vokov
Environment=HOME=/home/vokov

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable notebooklm-mcp
sudo systemctl start notebooklm-mcp
```

---

## Cloudflare Tunnel

### Підводні камені

Cloudflared на окремій машині — треба вказати IP Pi, а не `localhost`. І відкрити порт на Pi:

```bash
# На Pi — відкрити порт для машини з cloudflared
sudo iptables -I INPUT -p tcp --dport 8002 -j ACCEPT
```

```yaml
# config.yml на машині де cloudflared
ingress:
  - hostname: apibloom.exodus.pp.ua
    service: http://192.168.3.234:8002  # IP Pi, не localhost!
    originRequest:
      disableChunkedEncoding: false     # важливо для streaming
```

> ⚠️ Якщо глобально є `no-chunked-encoding: true` — обов'язково перекрийте через `disableChunkedEncoding: false` саме для MCP hostname.

### Перевірка через тунель

```bash
curl -X POST https://apibloom.exodus.pp.ua/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"initialize","id":1,"params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}'

# Очікувана відповідь:
# event: message
# data: {"jsonrpc":"2.0","id":1,"result":{"protocolVersion":"2024-11-05",...}}
```

---

## Підключення до ChatGPT

ChatGPT → Програми → Додати ще → Нова програма:

```
Назва:  Noteboklm
URL:    https://apibloom.exodus.pp.ua/mcp
Auth:   Без автентифікації
```

Після підключення в чаті:
```
List my NotebookLM notebooks
```

ChatGPT викликає `list_notebooks` через MCP і повертає всі ваші ноутбуки прямо з Google NotebookLM.

---

## Фінальна архітектура

```
ChatGPT / Claude / Codex
        │
        │ MCP Streamable HTTP
        ▼
https://apibloom.exodus.pp.ua/mcp
        │
        │ Cloudflare Tunnel
        ▼
Cloudflared (окрема машина в локальній мережі)
        │
        │ http://192.168.3.234:8002
        ▼
notebooklm-mcp :8002  ◄── systemd (Raspberry Pi 4B)
        │
        │ FastMCP + Python API
        ▼
notebooklm-py 0.3.3
        │
        │ Playwright / ~/.notebooklm/storage_state.json
        ▼
Google NotebookLM
```

---

## Підсумок

| # | Що | Результат |
|---|-----|-----------|
| 1 | `pipx install notebooklm-py` | Ізольований venv |
| 2 | Перенесли `storage_state.json` з ноутбука | Авторизація без браузера на Pi |
| 3 | `notebooklm skill install` + копія для Codex | Claude Code і Codex розуміють природньомовні команди |
| 4 | FastMCP обгортка з `streamable-http` | 60 рядків Python = повноцінний MCP сервер |
| 5 | Systemd + firewall + Cloudflare Tunnel | Доступний ззовні, живе після рестартів |
| 6 | ChatGPT підключено | ChatGPT читає 57 ноутбуків через MCP 🎉 |

---

## Що далі

- [ ] Bearer token автентифікація на MCP ендпоінті
- [ ] Webhook → `source add` — автоматичне наповнення ноутбуків
- [ ] Інтеграція з Memory Backend для збереження відповідей в git
- [ ] `generate_audio` + `download` як pipeline через n8n

---

*Написано на Raspberry Pi 4B, у приємній компанії Claude і Codex.  
Від "кукі протухли" до ChatGPT що читає ваші ноутбуки — один вечір і трохи наполегливості* 🍓
