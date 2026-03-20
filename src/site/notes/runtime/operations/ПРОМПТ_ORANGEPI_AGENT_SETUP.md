# Промпт для Claude на OrangePi (192.168.3.161)

> Скопіюй цей промпт у Claude CLI на OrangePi.

---

## Контекст

- OrangePi IP: `192.168.3.161`
- Основний сервер BLOOM Runtime: `https://bloom.exodus.pp.ua` (Alpine, 192.168.3.184)
- Репозиторій: `https://github.com/maxfraieho/bloom-core-ui.git`
- Встановити агента в: `~/membridge`
- Node ID: `orangepi`

---

## Задача

Налаштувати node-agent BLOOM Runtime на OrangePi:
1. Видалити старий клієнтський сервіс (якщо є)
2. Клонувати репозиторій як `~/membridge`
3. Налаштувати Python venv та залежності
4. Створити systemd сервіс `membridge-agent`
5. Підключити до основного сервера `https://bloom.exodus.pp.ua`

---

## Крок 0 — Передумови

```bash
# Переконайся що є git, python3, pip
git --version
python3 --version
which pip3 || which pip

# Перевір init system
systemctl --version 2>/dev/null && echo "systemd" || echo "not systemd"
rc-service --version 2>/dev/null && echo "openrc" || true

# Tailscale (якщо є)
tailscale ip --4 2>/dev/null || echo "no tailscale"
```

---

## Крок 1 — Зупинити і видалити старий клієнтський сервіс

```bash
# Знайти старі сервіси пов'язані з membridge/bloom
systemctl list-units --all | grep -iE "membridge|bloom|claude" || true
rc-service --list 2>/dev/null | grep -iE "membridge|bloom|claude" || true

# Зупинити якщо є (замінити <service-name> на реальну назву)
sudo systemctl stop membridge-client 2>/dev/null || true
sudo systemctl disable membridge-client 2>/dev/null || true
sudo systemctl stop membridge 2>/dev/null || true
sudo systemctl disable membridge 2>/dev/null || true

# Перевірити що нічого не слухає на :8001
ss -tlnp | grep 8001 || echo "port 8001 free"
```

---

## Крок 2 — Клонувати репозиторій

```bash
# Якщо вже є стара папка membridge — backup або видали
if [ -d ~/membridge ]; then
  echo "Existing ~/membridge found"
  ls ~/membridge
  # Якщо це старий клієнт — видали:
  # rm -rf ~/membridge
  # Якщо вже є правильний репо — просто pull:
  cd ~/membridge && git remote get-url origin
fi

# Клонувати (якщо папки немає або видалив стару)
git clone https://github.com/maxfraieho/bloom-core-ui.git ~/membridge
cd ~/membridge
git log --oneline -3
```

---

## Крок 3 — Python venv та залежності

```bash
cd ~/membridge

# Спробувати uv (швидший)
if command -v uv &>/dev/null; then
  uv sync
  PYTHON="$HOME/membridge/.venv/bin/python"
else
  # Fallback: стандартний venv
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt 2>/dev/null || \
    .venv/bin/pip install -q fastapi uvicorn httpx pydantic
  PYTHON="$HOME/membridge/.venv/bin/python"
fi

# Перевірити
$PYTHON -c "import fastapi, uvicorn, httpx; print('deps OK')"
```

---

## Крок 4 — Налаштувати .env.agent

```bash
# Визначити Tailscale IP (якщо є) або LAN IP
TS_IP=$(tailscale ip --4 2>/dev/null | head -1)
if [ -n "$TS_IP" ]; then
  MY_IP="$TS_IP"
  echo "Using Tailscale IP: $MY_IP"
else
  MY_IP=$(python3 -c "import socket; s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM); s.connect(('8.8.8.8',80)); print(s.getsockname()[0]); s.close()")
  echo "Using LAN IP: $MY_IP"
fi

cat > ~/membridge/.env.agent <<EOF
MEMBRIDGE_AGENT_KEY=3e16e8cbd4ca593931377829f063f9653b186c4bb80cc4e9
MEMBRIDGE_AGENT_DRYRUN=0
MEMBRIDGE_ALLOW_PROCESS_CONTROL=0
MEMBRIDGE_HOOKS_BIN=$HOME/membridge/hooks
MEMBRIDGE_NODE_ID=orangepi
MEMBRIDGE_AGENT_PORT=8001

# BLOOM Runtime integration
BLOOM_RUNTIME_URL=https://bloom.exodus.pp.ua
AGENT_ADVERTISE_URL=http://${MY_IP}:8001
EOF

echo "=== .env.agent ==="
cat ~/membridge/.env.agent
```

---

## Крок 5 — Firewall (відкрити порт 8001)

```bash
# ufw
sudo ufw allow 8001/tcp 2>/dev/null && echo "ufw: 8001 open" || true

# iptables (якщо ufw немає)
sudo iptables -C INPUT -p tcp --dport 8001 -j ACCEPT 2>/dev/null || \
  sudo iptables -A INPUT -p tcp --dport 8001 -j ACCEPT

# Перевірка
ss -tlnp | grep 8001 || echo "nothing on 8001 yet (normal before service start)"
```

---

## Крок 6 — Створити systemd сервіс

```bash
# Визначити шлях до python
VENV_PYTHON="$HOME/membridge/.venv/bin/python"

sudo tee /etc/systemd/system/membridge-agent.service > /dev/null <<EOF
[Unit]
Description=Membridge Agent (BLOOM node-agent)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$HOME/membridge
EnvironmentFile=$HOME/membridge/.env.agent
ExecStart=$VENV_PYTHON -m uvicorn agent.main:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable membridge-agent
sudo systemctl start membridge-agent
sleep 5
sudo systemctl status membridge-agent --no-pager | head -20
```

> **Якщо OpenRC (не systemd):**
> ```bash
> # Запустити напряму через run-agent.sh
> cat > ~/membridge/run-agent.sh <<'SHEOF'
> #!/bin/sh
> set -a
> . $HOME/membridge/.env.agent
> set +a
> exec $HOME/membridge/.venv/bin/python -m uvicorn agent.main:app --host 0.0.0.0 --port 8001
> SHEOF
> chmod +x ~/membridge/run-agent.sh
> ```

---

## Крок 7 — Верифікація локально

```bash
# Health check
curl -s http://localhost:8001/health | python3 -m json.tool

# Має показати:
# "status": "ok"
# "node_id": "orangepi"
# "runtime_url": "https://bloom.exodus.pp.ua"
```

---

## Крок 8 — Перевірити реєстрацію на основному сервері

```bash
# З OrangePi:
curl -s https://bloom.exodus.pp.ua/api/runtime/workers | python3 -c "
import sys, json
for w in json.load(sys.stdin):
    print(f\"{w['node_id']}: {w['status']}  url={w['url']}\")
"

# Очікуваний результат:
# orangepi: online  url=http://192.168.3.161:8001  (або Tailscale IP)
# rpi4b: online     url=http://100.x.x.x:8001
# alpine: online    url=http://100.113.140.25:8001
```

---

## Крок 9 — Тест dispatch задачі

```bash
TASK_ID=$(curl -s -X POST https://bloom.exodus.pp.ua/api/runtime/llm-tasks \
  -H "Content-Type: application/json" \
  -d '{"context_id":"orangepi-test","agent_slug":"writer","prompt":"Say: Hello from OrangePi!","desired_format":"text","policy":{"timeout_sec":60}}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

echo "Task: $TASK_ID"

curl -s -X POST "https://bloom.exodus.pp.ua/api/runtime/llm-tasks/$TASK_ID/dispatch" \
  | python3 -m json.tool

# Poll status
for i in $(seq 1 12); do
  STATUS=$(curl -s "https://bloom.exodus.pp.ua/api/runtime/llm-tasks/$TASK_ID" \
    | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "[$i] $STATUS"
  [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ] && break
  sleep 5
done

# Artifact
curl -s "https://bloom.exodus.pp.ua/api/runtime/artifacts?task_id=$TASK_ID" \
  | python3 -c "import sys,json; arts=json.load(sys.stdin); print(arts[0]['content'] if arts else 'no artifact')"
```

---

## Якщо виникли проблеми

**Агент не стартує:**
```bash
sudo journalctl -u membridge-agent -n 30 --no-pager
```

**Порт зайнятий:**
```bash
ss -tlnp | grep 8001
kill $(lsof -ti:8001) 2>/dev/null
```

**Runtime не бачить orangepi:**
```bash
# Перевір що BLOOM_RUNTIME_URL доступний з OrangePi
curl -s https://bloom.exodus.pp.ua/api/runtime/health
# Перевір .env.agent
cat ~/membridge/.env.agent | grep -E "RUNTIME|NODE|ADVERTISE"
```
