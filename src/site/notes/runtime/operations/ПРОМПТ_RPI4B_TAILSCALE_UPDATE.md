# Промпт для Claude на rpi4b

> Скопіюй цей промпт у Claude CLI на Raspberry Pi 4B.

---

## Задача

Оновити `agent/main.py` на rpi4b для Tailscale мережі. Зміни ідентичні Alpine — але спочатку потрібно синхронізувати код.

### Передумови

```bash
# 1. Перевір що Tailscale працює
tailscale status
tailscale ip --4

# 2. Перевір що порт 8001 відкритий
sudo ufw status | grep 8001
# Якщо ні:
echo "805235io." | sudo -S ufw allow 8001/tcp
```

### Варіант А: Pull з Alpine (якщо Alpine вже закомітив)

```bash
cd ~/membridge
git pull origin main
```

Після pull — відразу до кроку "Налаштування .env.agent".

### Варіант Б: Внести зміни локально

Внести ті ж самі зміни у `agent/main.py` що й Alpine:

1. `_get_ip_addrs()` — Tailscale > UDP outbound > hostname, виключити весь `127.x.x.x`
2. `_register_with_runtime()` — використовувати `AGENT_ADVERTISE_URL`
3. `runtime_heartbeat_loop()` — надсилати `{ url, ip_addrs }` у heartbeat

(Деталі коду — див. ПРОМПТ_ALPINE_TAILSCALE_UPDATE.md)

### Налаштування .env.agent

```bash
cat >> ~/membridge/.env.agent <<'EOF'

# Tailscale networking
AGENT_ADVERTISE_URL=http://$(tailscale ip --4 | head -1):8001
BLOOM_RUNTIME_URL=https://bloom.exodus.pp.ua
EOF
```

**ВАЖЛИВО:** Перевір що `BLOOM_RUNTIME_URL` не дублюється:
```bash
grep BLOOM_RUNTIME_URL ~/membridge/.env.agent
# Має бути тільки один рядок. Якщо два — видали старий.
```

### Перезапуск і перевірка

```bash
sudo systemctl restart membridge-agent
sleep 5

# Локальний health
curl -s http://localhost:8001/health | python3 -m json.tool

# Статус у Runtime
curl -s https://bloom.exodus.pp.ua/api/runtime/workers | python3 -c "
import sys, json
for w in json.load(sys.stdin):
    print(f\"{w['node_id']}: {w['status']}  url={w['url']}  ips={w.get('ip_addrs', [])}\")
"
```

Очікуваний результат:
```
rpi4b: online  url=http://100.x.x.x:8001  ips=['100.x.x.x', '192.168.3.234']
alpine: online  url=http://100.x.x.x:8001  ips=['100.x.x.x', '192.168.3.184']
```

### Тест виконання задачі

```bash
# Створити задачу і перевірити що runtime може дістатись до rpi4b
TASK_ID=$(curl -s -X POST https://bloom.exodus.pp.ua/api/runtime/llm-tasks \
  -H "Content-Type: application/json" \
  -d '{"context_id":"test","agent_slug":"writer","prompt":"Say hello from rpi4b","desired_format":"text"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])")

curl -s -X POST "https://bloom.exodus.pp.ua/api/runtime/llm-tasks/$TASK_ID/dispatch"

# Poll
for i in $(seq 1 15); do
  STATUS=$(curl -s "https://bloom.exodus.pp.ua/api/runtime/llm-tasks/$TASK_ID" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])")
  echo "Attempt $i: $STATUS"
  [ "$STATUS" = "completed" ] && break
  sleep 5
done
```
