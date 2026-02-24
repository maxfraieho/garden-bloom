---
{"tags":["domain:arch","status:canonical","format:spec","feature:execution"],"created":"2026-02-24","updated":"2026-02-24","tier":1,"title":"BLOOM Runtime Identity","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/architecture/foundation/BLOOM_RUNTIME_IDENTITY/","dgPassFrontmatter":true,"noteIcon":""}
---


# BLOOM — Runtime Identity

> Створено: 2026-02-24
> Автор: Головний архітектор системи
> Статус: Canonical
> Мова: Українська (канонічна)

---

## 1. Визначення

**BLOOM** — Behavioral Logic Orchestration for Order-Made Systems
**UA:** Оркестрація поведінкової логіки для індивідуально створених систем

BLOOM — це **execution environment**, в якому виконуються агенти Garden Bloom.

### Canonical Runtime Descriptor

**EN:** BLOOM is an Execution Environment for Behavioral Logic.
**UA:** BLOOM — це середовище виконання поведінкової логіки.

BLOOM відповідає за:

- **Orchestration execution pipeline** — управління послідовністю виконання behavioral logic
- **Isolation execution contexts** — ізоляція контекстів виконання між агентами
- **Delegated behavioral logic execution** — делегування виконання логіки на агентів
- **Memory integration через membridge** — інтеграція пам'яті через канонічний інтерфейс
- **Execution lifecycle management** — управління повним життєвим циклом виконання

### BLOOM НЕ є:

| Помилкове розуміння | Реальність |
|---------------------|------------|
| Knowledge base | BLOOM виконує, а не зберігає знання |
| UI-фреймворк | BLOOM — runtime, не presentation layer |
| Маркетинговий бренд | BLOOM — canonical execution identity |
| Просто оркестратор | BLOOM включає isolation, memory та lifecycle |

**BLOOM є execution layer.**

---

## 2. Відношення до Garden Bloom

Garden Bloom має чітку шарову архітектуру:

```
┌─────────────────────────────────────┐
│         Knowledge Layer             │  ← Obsidian vault, definitions
├─────────────────────────────────────┤
│         Proposal Layer              │  ← Proposal system, inbox
├─────────────────────────────────────┤
│       Orchestration Layer           │  ← Agent routing, scheduling
├─────────────────────────────────────┤
│     Execution Layer (BLOOM)         │  ← Runtime environment
└─────────────────────────────────────┘
```

**BLOOM = canonical execution runtime.**

Garden Bloom — продукт. BLOOM — execution identity цього продукту.

---

## 3. Execution Context Model

Кожен master-код активує **Execution Context**.

```
Execution Context
├── Агенти (active agent instances)
├── Delegated Zones (ізольовані зони виконання)
├── Execution State (поточний стан pipeline)
├── Memory Bindings (зв'язки з membridge)
└── Behavioral Logic (завантажена логіка виконання)
```

### Правила Execution Context:

1. **Один master-код** → один Execution Context
2. **Ізоляція** — контексти не мають спільного mutable state
3. **Lifecycle** — контекст створюється при активації, знищується при деактивації
4. **Аудит** — кожна операція в контексті логується

---

## 4. UX-принцип

Користувач **не "входить у сад"**.

Користувач **активує execution environment**.

### Канонічні UX терміни:

| Контекст | Канонічний термін |
|----------|-------------------|
| Вхід у систему | **Активувати середовище** |
| Головна сторінка | **Runtime Overview** |
| Перегляд нотаток | **Behavioral Definitions** |
| Граф знань | **Execution Graph** |
| Вихід | **Деактивувати середовище** |

### Заборонені UX терміни:

- ~~"Увійти до саду"~~
- ~~"Відкрити сад"~~
- ~~"Digital Garden"~~

---

## 5. Семантичні зв'язки

**Цей документ є:**
- Канонічним визначенням BLOOM як execution identity
- Foundation-рівневим документом архітектури

**Цей документ залежить від:**
- [[АРХІТЕКТУРНИЙ_КОРІНЬ]] — аксіоми системи
- [[КАНОНІЧНА_АРХІТЕКТУРА_ВИКОНАННЯ]] — повна архітектура виконання

**На цей документ посилаються:**
- [[КОНТРАКТ_АГЕНТА_V1]] — контракт агента в контексті BLOOM
- [[АБСТРАКЦІЯ_РІВНЯ_ОРКЕСТРАЦІЇ]] — orchestration layer над BLOOM
- [[BLOOM_AUTH_UI_SPEC]] — специфікація UX входу
