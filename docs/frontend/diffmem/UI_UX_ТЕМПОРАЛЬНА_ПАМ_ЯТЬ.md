---
tags:
  - domain:frontend
  - feature:memory
  - feature:diffmem
  - status:canonical
  - format:spec
created: 2026-03-02
updated: 2026-03-14
title: "UI/UX — Темпоральна пам'ять"
dg-publish: true
---

# UI/UX temporal memory для BLOOMfront

> Документ описує лише UI/UX-проєкцію канонічних бекенд-контрактів DiffMem.

---

## 1. Призначення

Фронтенд повинен дати користувачу керований доступ до temporal memory без втрати ясності між:

- поточним знанням
- історією змін

Нижче зафіксовані UI/UX-елементи, які мають з'явитися на фронті.

---

## 2. Depth switcher

### Роль

Depth switcher є головним керуючим елементом для `context assembly`.

### Канонічні режими

| Режим | UX-ярлик | Значення для користувача |
|------|----------|---------------------------|
| `surface` | Коротко | швидка відповідь по current-state |
| `wide` | Широко | кілька релевантних сутностей без історії |
| `deep` | Детально | повний current-state context |
| `temporal` | У часі | current-state + історія на вимогу |

### UX-вимоги

- перемикач має бути явним, а не прихованим за advanced settings
- `temporal` повинен мати окремий візуальний знак, що це режим з історією
- зміна depth не повинна змінювати семантику пошуку, лише семантику контексту

---

## 3. Панель history / ревізій для entity

### Роль

History panel показує timeline ревізій для конкретної сутності.

### Джерело даних

`GET /v1/memory/entities/:id/history`

### Мінімальний склад UI

| Елемент | Призначення |
|---------|-------------|
| список ревізій | показати доступні `sha`/timestamps/messages |
| summary changes | показати `additions`/`deletions` з `summary` |
| cursor / pagination | не перевантажувати UI довгою історією |
| entry selection | вибір ревізії для snapshot або diff |

### UX-правило

History panel не є частиною основного search dropdown або результатів списку. Це окрема інспекційна поверхня.

---

## 4. Перегляд diff між ревізіями

### Роль

Diff viewer показує різницю між двома ревізіями сутності.

### Джерело даних

`GET /v1/memory/entities/:id/diff?from=<sha>&to=<sha>`

### Мінімальний склад UI

| Елемент | Призначення |
|---------|-------------|
| selector `from` | вибір початкової ревізії |
| selector `to` | вибір кінцевої ревізії |
| diff summary | `additions` / `deletions` |
| patch view | читабельний показ `patch` |

### UX-правило

Diff view має бути read-only і пояснювальним. Це не редактор content і не новий спосіб читання current entity.

---

## 5. `temporal answer` attachments у контексті

### Роль

Коли користувач ставить temporal-запит і `depth=temporal`, фронтенд повинен вміти показати, що відповідь ґрунтується не лише на current-state, а й на history layer.

### Мінімальний склад UI

| Attachment | Призначення |
|------------|-------------|
| recent revisions | показати останні релевантні commits |
| compared revisions | показати, які версії були зіставлені |
| snapshot link | відкрити historical snapshot |
| entity source | показати, до якої сутності належить history |

### UX-правило

Temporal attachments мають з'являтися тільки у temporal-відповідях, а не у звичайному factual mode.

---

## 6. Staging status для writer flow

### Роль

Якщо у фронтенді є surface для writer/session flow, він повинен показувати різницю між:

- staged but not committed
- committed

### Канонічний зміст

| Стан | Значення |
|------|----------|
| `staged` | зміни підготовлені, але ще не зафіксовані |
| `committing` | іде фінальний commit |
| `committed` | один commit успішно завершений |

### UX-правило

Фронтенд не повинен показувати staged changes як уже збережену історію, доки commit не відбувся.

---

## 7. Рекомендована навігаційна схема

| Поверхня | Що має бути |
|----------|-------------|
| Search / chat | depth switcher і current-state results |
| Entity detail | tab `Поточний стан` + tab `Історія` |
| History tab | revisions list + compare action + snapshot action |
| Temporal answer | attachments block під відповіддю |
| Writer flow | session status / staged changes / final commit state |

---

## 8. Антипатерни

| Антипатерн | Чому це помилка |
|------------|-----------------|
| показувати history entries в основному списку search results | history не є primary index |
| автоматично відкривати temporal mode для всіх запитів | це збільшує шум і latency |
| ховати `depth` настільки глибоко, що користувач не розуміє режим відповіді | порушується пояснюваність |
| змішувати current entity content і patch в одному текстовому блоці | губиться межа між станом і еволюцією |

---

## Семантичні зв'язки

- [[frontend/diffmem/УЗГОДЖЕННЯ_КОНТРАКТІВ_З_БЕКЕНДОМ]]
- [[frontend/diffmem/СТАНИ_ДАНИХ_ТА_ВЕРИФІКАЦІЯ]]
- [[frontend/ux-plan/ПЛАН_ПОКРАЩЕННЯ_UX_V1]]
