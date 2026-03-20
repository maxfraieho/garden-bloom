# Промпт для Claude на Alpine — перевірка Worker Health Cards

> Скопіюй у Claude CLI на Alpine сервері.

---

## Задача

Перевірити що backend endpoints для Worker Health Cards працюють коректно.

### Що перевірити

#### 1. Endpoint `/api/runtime/workers/:id/system-info`

Цей endpoint проксює запит до агента ноди і повертає системну інформацію.

```bash
# Список воркерів
curl -s https://bloom.exodus.pp.ua/api/runtime/workers | python3 -c "
import sys, json
workers = json.load(sys.stdin)
for w in workers:
    print(f\"  {w['node_id']}: status={w['status']}  url={w.get('url', 'N/A')}\")
"

# System info для кожного воркера (замінити WORKER_ID)
curl -s https://bloom.exodus.pp.ua/api/runtime/workers/WORKER_ID/system-info | python3 -m json.tool
```

**Очікуваний результат:**
```json
{
  "hostname": "alpine",
  "os": "Linux ...",
  "arch": "x86_64",
  "uptime": "5d 3h",
  "memory_mb": { "total": 8192, "used": 4500, "free": 3692 },
  "disk_gb": { "total": 50, "free": 30 },
  "claude_cli": "1.x.x",
  "python": "3.11.x",
  "agent_version": "0.4.x"
}
```

Якщо агент не має endpoint `/system-info` — потрібно його додати.

#### 2. Endpoint `/api/runtime/workers/:id/stats`

```bash
curl -s https://bloom.exodus.pp.ua/api/runtime/workers/WORKER_ID/stats | python3 -m json.tool
```

**Очікуваний результат:**
```json
{
  "total": 15,
  "completed": 12,
  "failed": 2,
  "running": 1
}
```

#### 3. Перевірка що агент має `/system-info` endpoint

```bash
# Локально на агенті
curl -s http://localhost:8001/system-info | python3 -m json.tool
```

Якщо 404 — потрібно додати в `agent/main.py`:

```python
@app.get("/system-info")
async def system_info():
    import platform, shutil, psutil, subprocess

    mem = psutil.virtual_memory()
    disk = shutil.disk_usage("/")

    # Claude CLI version
    claude_cli = None
    try:
        r = subprocess.run(["claude", "--version"], capture_output=True, text=True, timeout=5)
        if r.returncode == 0:
            claude_cli = r.stdout.strip()
    except Exception:
        pass

    # Uptime
    uptime = None
    try:
        with open("/proc/uptime") as f:
            secs = float(f.read().split()[0])
            days = int(secs // 86400)
            hours = int((secs % 86400) // 3600)
            uptime = f"{days}d {hours}h"
    except Exception:
        pass

    return {
        "hostname": platform.node(),
        "os": f"{platform.system()} {platform.release()}",
        "arch": platform.machine(),
        "uptime": uptime,
        "memory_mb": {
            "total": round(mem.total / 1048576),
            "used": round(mem.used / 1048576),
            "free": round(mem.available / 1048576),
        },
        "disk_gb": {
            "total": round(disk.total / 1073741824, 1),
            "free": round(disk.free / 1073741824, 1),
        },
        "claude_cli": claude_cli,
        "python": platform.python_version(),
        "agent_version": VERSION,
    }
```

**Залежність:** `pip install psutil` (якщо не встановлено).

#### 4. Перевірка всіх нод

```bash
for NODE in alpine rpi4b orangepi; do
  echo "=== $NODE ==="
  curl -s https://bloom.exodus.pp.ua/api/runtime/workers/$NODE/system-info 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  FAILED"
  curl -s https://bloom.exodus.pp.ua/api/runtime/workers/$NODE/stats 2>/dev/null | python3 -m json.tool 2>/dev/null || echo "  FAILED"
  echo
done
```

#### 5. Після виправлень

```bash
rc-service membridge-agent restart
curl -s http://localhost:8001/system-info | python3 -m json.tool
```
