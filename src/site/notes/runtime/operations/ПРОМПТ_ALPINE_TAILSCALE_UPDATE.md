# Промпт для Claude на Alpine (основний сервер)

> Скопіюй цей промпт у Claude CLI на Alpine сервері.

---

## Задача

Оновити `agent/main.py` на Alpine для підтримки Tailscale мережі та `AGENT_ADVERTISE_URL`.

### Контекст

- BLOOM Runtime працює на цьому ж сервері (:5000) і доступний через `https://bloom.exodus.pp.ua`
- Всі ноди (Alpine, rpi4b, Oracle Cloud, Termux) підключені через Tailscale
- Runtime heartbeat endpoint тепер приймає `{ url, ip_addrs }` для оновлення URL воркера
- Нова env змінна `AGENT_ADVERTISE_URL` дозволяє явно задати URL воркера

### Що зробити

#### 1. Оновити `_get_ip_addrs()` в `~/membridge/agent/main.py`

Пріоритет IP:
1. Tailscale IP (`tailscale ip --4`)
2. UDP outbound IP (socket connect до 8.8.8.8)
3. `hostname -I` fallback

Виключити весь `127.x.x.x` діапазон (не тільки `127.0.0.1`).

```python
def _get_ip_addrs() -> list[str]:
    addrs: list[str] = []
    # 1. Tailscale IP (highest priority)
    try:
        r = subprocess.run(
            ["tailscale", "ip", "--4"],
            capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0:
            ts_ip = r.stdout.strip().split("\n")[0].strip()
            if ts_ip and not ts_ip.startswith("127."):
                addrs.append(ts_ip)
    except Exception:
        pass
    # 2. UDP outbound IP
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        outbound = s.getsockname()[0]
        s.close()
        if not outbound.startswith("127.") and outbound not in addrs:
            addrs.append(outbound)
    except Exception:
        pass
    # 3. hostname resolution (filtered)
    try:
        hostname = socket.gethostname()
        for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
            addr = info[4][0]
            if not addr.startswith("127.") and addr not in addrs:
                addrs.append(addr)
    except Exception:
        pass
    return addrs
```

#### 2. Оновити `_register_with_runtime()` — використовувати `AGENT_ADVERTISE_URL`

```python
async def _register_with_runtime() -> None:
    if not RUNTIME_URL:
        return
    ip_addrs = _get_ip_addrs()
    # AGENT_ADVERTISE_URL overrides auto-detection
    advertise_url = os.environ.get("AGENT_ADVERTISE_URL", "")
    if not advertise_url and ip_addrs:
        advertise_url = f"http://{ip_addrs[0]}:{AGENT_PORT}"
    elif not advertise_url:
        advertise_url = f"http://{socket.gethostname()}:{AGENT_PORT}"

    payload = {
        "name": NODE_ID,
        "url": advertise_url,
        "status": "online",
        "ip_addrs": ip_addrs,
        "capabilities": { ... },  # keep existing
        "agent_version": VERSION,
        "os_info": _get_os_info(),
        "install_method": os.environ.get("MEMBRIDGE_INSTALL_METHOD", "manual"),
    }
    # POST to RUNTIME_URL/api/runtime/workers
    ...
```

#### 3. Оновити `runtime_heartbeat_loop()` — надсилати URL та ip_addrs

```python
async def runtime_heartbeat_loop():
    while True:
        await asyncio.sleep(30)
        if not RUNTIME_URL:
            continue
        ip_addrs = _get_ip_addrs()
        advertise_url = os.environ.get("AGENT_ADVERTISE_URL", "")
        if not advertise_url and ip_addrs:
            advertise_url = f"http://{ip_addrs[0]}:{AGENT_PORT}"
        
        payload = {}
        if advertise_url:
            payload["url"] = advertise_url
        if ip_addrs:
            payload["ip_addrs"] = ip_addrs
        
        try:
            async with httpx.AsyncClient() as client:
                await client.post(
                    f"{RUNTIME_URL}/api/runtime/workers/{NODE_ID}/heartbeat",
                    json=payload,
                    timeout=10,
                )
        except Exception as e:
            logger.warning(f"Runtime heartbeat failed: {e}")
```

#### 4. Додати в `~/.env.agent` (або `/root/membridge/.env.agent`):

```bash
# Tailscale IP цього сервера (заміни на свій)
AGENT_ADVERTISE_URL=http://$(tailscale ip --4 | head -1):8001
```

Або для зовнішнього доступу через публічний URL:
```bash
BLOOM_RUNTIME_URL=https://bloom.exodus.pp.ua
```

#### 5. Після змін

```bash
# Перезапуск
rc-service membridge-agent restart   # Alpine OpenRC
# або
systemctl restart membridge-agent    # якщо systemd

# Перевірка
curl -s http://localhost:8001/health | python3 -m json.tool
curl -s https://bloom.exodus.pp.ua/api/runtime/workers | python3 -c "
import sys, json
for w in json.load(sys.stdin):
    print(f\"{w['node_id']}: {w['status']}  url={w['url']}\")
"
```

#### 6. Git commit

```bash
cd ~/membridge
git add agent/main.py
git commit -m "feat(agent): Tailscale IP priority + AGENT_ADVERTISE_URL support"
```
