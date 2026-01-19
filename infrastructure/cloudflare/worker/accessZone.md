# AccessZone Logic

## Поточний стан

**СТАТУС:** 🔴 НЕ ПРАЦЮЄ

### Відома проблема

AccessZone створюється, але:
1. ❌ Не зберігається в KV
2. ❌ Не з'являється в списку зон
3. ❌ Доступ по зоні не працює

### Симптоми

```
POST /zones/create → 200 OK (zone created)
GET /zones/list → [] (empty array)
GET /zones/validate/:zoneId → 404 (zone not found)
```

## Очікувана поведінка

### Створення зони

```javascript
POST /zones/create
Body: {
  "name": "Guest Access",
  "noteIds": ["note1", "note2"],
  "expiresIn": 3600000
}

Response: {
  "zoneId": "zone_abc123",
  "accessCode": "GUEST-1234",
  "expiresAt": "2024-01-15T12:00:00Z"
}
```

### Зберігання в KV

```javascript
// Key pattern
`zone:${zoneId}` → {
  id: zoneId,
  name: "Guest Access",
  noteIds: ["note1", "note2"],
  accessCode: "GUEST-1234",
  createdAt: timestamp,
  expiresAt: timestamp
}

// Index for listing
`zones:index` → ["zone_abc123", "zone_def456", ...]
```

## Точки для дебагу

### 1. Перевірити KV write

```javascript
// В /zones/create handler
await env.KV.put(`zone:${zoneId}`, JSON.stringify(zoneData));
console.log('Zone saved:', zoneId);

// Перевірка
const saved = await env.KV.get(`zone:${zoneId}`);
console.log('Zone retrieved:', saved);
```

### 2. Перевірити KV binding

```javascript
// В /health endpoint
const kvTest = await env.KV.put('test', 'value');
const kvRead = await env.KV.get('test');
return { kv: kvRead === 'value' ? 'ok' : 'failed' };
```

### 3. Перевірити index update

```javascript
// При створенні зони
const index = await env.KV.get('zones:index', 'json') || [];
index.push(zoneId);
await env.KV.put('zones:index', JSON.stringify(index));
```

## Дії для виправлення

### Для Cloud CLI / ChatGPT

1. Проаналізувати handler `/zones/create`
2. Перевірити KV namespace binding в wrangler.toml / Dashboard
3. Перевірити правильність `env.KV` виклику
4. Додати логування для діагностики

### Для Comet Browser

Див. [agents/comet/debug.md](../../../agents/comet/debug.md)

## Пов'язані файли

- Worker код: `./index.js`
- Comet debug: `../../../agents/comet/debug.md`
- Frontend hook: `src/hooks/useAccessZones.ts`
