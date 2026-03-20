---
tags:
  - domain:runtime
  - status:canonical
  - format:guide
  - feature:membridge
created: 2026-02-22
updated: 2026-03-15
legacy_name: "MEMBRIDGE_SYNC_MODES.md"
title: "Режими синхронізації Membridge"
tier: 2
---

# Режими синхронізації Membridge

Membridge підтримує дві операції синхронізації: **pull** та **push**, кожна з різною поведінкою залежно від **ролі лідерства** вузла (primary або secondary).

---

## Push

**Призначення:** Завантажити локальний знімок SQLite DB до MinIO (робить його канонічною віддаленою копією).

### Push primary (дозволено)

1. Перевірити роль лідерства → primary ✅
2. Зупинити worker (для узгодженого знімка)
3. `VACUUM INTO` тимчасовий знімок + перевірка цілісності
4. Перезапустити worker (незалежно від завантаження)
5. Обчислити SHA256 знімка
6. Порівняти з віддаленим SHA256 (пропустити, якщо однакові)
7. Захопити розподілений push lock
8. Завантажити DB + SHA256 + manifest до MinIO
9. Перевірити віддалений SHA256

### Push secondary (заблоковано)

```
[0/6] Leadership: role=secondary  node=mynode  primary=rpi4b
  SECONDARY: push blocked by default.
  Options:
    - Request promotion: POST /projects/<cid>/leadership/select
    - Override (unsafe): ALLOW_SECONDARY_PUSH=1
```

Код завершення 3.

### Env vars, що впливають на push

| Змінна | За замовчуванням | Ефект |
|--------|-----------------|-------|
| `ALLOW_SECONDARY_PUSH` | `0` | Дозволити secondary виконати push (небезпечно) |
| `FORCE_PUSH` | `0` | Ігнорувати активний push lock |
| `LOCK_TTL_SECONDS` | `7200` | TTL push lock |
| `STALE_LOCK_GRACE_SECONDS` | `60` | Пільговий період після закінчення lock |
| `LEADERSHIP_ENABLED` | `1` | Вимкнути всі перевірки лідерства, якщо `0` |

---

## Pull

**Призначення:** Завантажити канонічну DB з MinIO та замінити локальну копію.

### Pull secondary (дозволено, з резервною копією)

1. Перевірити роль лідерства → secondary ✅
2. Завантажити віддалений SHA256
3. Порівняти з локальним (пропустити, якщо однакові)
4. Завантажити віддалену DB до тимчасового файлу
5. Перевірити SHA256 завантаження
6. **Резервна копія** поточної локальної DB до `~/.claude-mem/backups/pull-overwrite/<ts>/`
7. Зупинити worker
8. Атомарна заміна локальної DB
9. Перевірка цілісності DB + перезапуск worker

### Pull primary (відхиляється, якщо локальна DB існує)

```
  SHA256 mismatch — pulling remote DB
  [leadership] role=primary  node=rpi4b  primary=rpi4b
  PRIMARY: refusing destructive pull overwrite of local DB.
    local_sha:  abc123...
    remote_sha: def456...
  Primary is the single source of truth — remote drift must be resolved manually.
  Options:
    - Inspect: download remote DB to a temp path and compare
    - Override (unsafe): ALLOW_PRIMARY_PULL_OVERRIDE=1
    - Handover: POST /projects/<cid>/leadership/select
```

Код завершення 2.

**Виняток:** Якщо локальна DB ще не існує (початкове налаштування), primary може виконати pull вільно — нема чого захищати.

### Env vars, що впливають на pull

| Змінна | За замовчуванням | Ефект |
|--------|-----------------|-------|
| `ALLOW_PRIMARY_PULL_OVERRIDE` | `0` | Дозволити primary перезаписати через pull (небезпечно) |
| `PULL_BACKUP_MAX_DAYS` | `14` | Видалити резервні копії старші за N днів |
| `PULL_BACKUP_MAX_COUNT` | `50` | Зберігати не більше N pull-резервних копій |
| `MEMBRIDGE_NO_RESTART_WORKER` | `0` | Пропустити перезапуск worker після pull |
| `LEADERSHIP_ENABLED` | `1` | Вимкнути всі перевірки лідерства, якщо `0` |

---

## Резервні копії SAFE-PULL

Перед кожним pull-перезаписом поточна локальна DB зберігається до:
```
~/.claude-mem/backups/pull-overwrite/<YYYYMMDD-HHMMSS>/
  claude-mem.db        # повна копія локальної DB перед перезаписом
  chroma.sqlite3       # векторна DB (якщо присутня)
  manifest.json        # метадані: часові мітки, SHA, кількість obs, прапор local_ahead
```

Резервні копії зберігаються протягом `PULL_BACKUP_MAX_DAYS` днів та не більше `PULL_BACKUP_MAX_COUNT` знімків.

Для відновлення з резервної копії:
```bash
cp ~/.claude-mem/backups/pull-overwrite/<ts>/claude-mem.db ~/.claude-mem/claude-mem.db
```

---

## Політика Write-Local

Як primary, так і secondary вузли можуть в будь-який момент записувати до локальної SQLite DB (worker та Claude CLI роблять це). Це навмисно — локальні записи завжди дозволені. Ворота лідерства контролюють лише **синхронізацію з MinIO** (pull/push).

Коли secondary має локальні записи, що ще не були завантажені:
- `cm-doctor` покаже `local_ahead: YES`
- Secondary не може виконати push (заблоковано)
- Щоб зберегти дані лише з secondary: спочатку підвищіть secondary до primary

---

## Коди завершення

| Код | Значення |
|-----|----------|
| 0 | Успіх (або вже актуально) |
| 1 | Помилка (MinIO, DB, конфігурація тощо) |
| 2 | Pull primary відхилено (ворота ролі) |
| 3 | Push secondary заблоковано (ворота ролі) |

---

## Семантичні зв'язки

**Цей документ є частиною:**
- [[ЛІДЕРСТВО_MEMBRIDGE]] — модель лідерства, що визначає ролі push/pull

**Цей документ залежить від:**
- [[АВТОХАРТБІТ_MEMBRIDGE]] — автоматична синхронізація через heartbeat

**Від цього документа залежать:**
- [[ДІАГНОСТИКА_ПАМЯТІ_CLAUDE_ARM64]] — усунення несправностей sync на ARM64
