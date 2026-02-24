---
tags:
  - domain:frontend
  - status:canonical
  - format:spec
  - feature:execution
created: 2026-02-24
updated: 2026-02-24
tier: 2
title: "BLOOM Auth UI Spec"
---

# BLOOM — Специфікація UX входу

> Створено: 2026-02-24
> Автор: Головний архітектор системи
> Статус: Canonical
> Мова: Українська (канонічна)

---

## 1. UX-принципи

Сторінка входу — це **activation screen** для execution environment, а не маркетингова landing page.

### Принципи:

1. **Execution identity** — користувач активує runtime, не "входить у сад"
2. **Мінімалізм** — жодного декоративного контенту, лише функціональні елементи
3. **Technical feel** — стиль execution console (Notion + Linear + Vercel)
4. **Trust** — чітка ідентифікація системи через BLOOM branding

---

## 2. Канонічні тексти

### Заголовок
```
BLOOM
```

### Підзаголовок
```
Індивідуальне середовище виконання
```

### Поле введення
- Label: `Ключ доступу`
- Placeholder: `Введіть ключ доступу`

### Кнопка
```
Активувати середовище
```

### Footer
```
Garden Bloom Runtime
```

### Заборонені тексти

| Заборонено | Причина |
|------------|---------|
| "Увійти до саду" | Метафора саду не є primary identity |
| "Відкрити сад" | Те саме |
| "Welcome" | Маркетинговий тон |
| "Login / Sign in" | Не відповідає execution семантиці |

---

## 3. Layout

```
┌─────────────────────────────────────────┐
│                          [lang] [theme] │
│                                         │
│                                         │
│            [ BLOOM logo ]               │
│                                         │
│               BLOOM                     │
│    Індивідуальне середовище виконання    │
│                                         │
│     ┌──────────────────────────┐        │
│     │   Введіть ключ доступу   │        │
│     └──────────────────────────┘        │
│                                         │
│     ┌──────────────────────────┐        │
│     │  Активувати середовище   │        │
│     └──────────────────────────┘        │
│                                         │
│                                         │
│          Garden Bloom Runtime           │
└─────────────────────────────────────────┘
```

---

## 4. Semantic meaning

| Елемент | Семантика |
|---------|-----------|
| BLOOM logo | Ідентифікація execution runtime |
| "BLOOM" | Назва runtime environment |
| Підзаголовок | Пояснення призначення |
| Input field | Master-key для активації Execution Context |
| Button | Ініціація activation sequence |
| Footer | Product attribution |

---

## 5. Візуальний стиль

- **Background**: animated node-network (canvas) — символізує execution graph
- **Input**: glassmorphism, центрований
- **Button**: primary color (Bloom Glow), full width
- **Typography**: modern sans-serif, tracking-wide
- **Palette**: Deep Teal on Near Black

---

## 6. Семантичні зв'язки

**Цей документ залежить від:**
- [[BLOOM_RUNTIME_IDENTITY]] — canonical execution identity
- [[BLOOM_DESIGN_SYSTEM]] — візуальна система

**Реалізація:**
- `src/components/AccessGateUI.tsx` — React компонент
