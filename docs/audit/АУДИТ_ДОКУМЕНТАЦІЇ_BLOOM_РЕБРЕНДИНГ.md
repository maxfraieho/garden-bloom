---
tags:
  - domain:meta
  - status:canonical
  - format:audit
created: 2026-02-24
updated: 2026-02-24
tier: 2
title: "Аудит документації: BLOOM ребрендинг"
---

# Аудит документації: BLOOM ребрендинг

> Створено: 2026-02-24
> Автор: Технічний редактор
> Статус: Canonical
> Scope: Повний аудит термінологічної відповідності після ребрендингу BLOOM Runtime
> Мова: Українська (канонічна)

---

## 1. Контекст

BLOOM (Behavioral Logic Orchestration for Order-Made Systems) — canonical execution runtime Garden Bloom. Ребрендинг зафіксував нову семантику:

- **EN:** Execution Environment for Behavioral Logic
- **UA:** Середовище виконання поведінкової логіки

Цей аудит фіксує місця, де залишилась стара термінологія або старі mental models.

---

## 2. Знайдені невідповідності

### 2.1 "Digital Garden" замість BLOOM Runtime / Execution Platform

| Файл | Секція / Рядок | Фрагмент | Рекомендація |
|------|----------------|----------|--------------|
| `docs/manifesto/МАНІФЕСТ.md` | §1 Бачення | "Agentic Digital Garden" | **Replace** → "BLOOM Execution Platform" або зберегти як historical term з поясненням |
| `docs/manifesto/ГЛОСАРІЙ.md` | Рядок 26 | "Agentic Digital Garden — система, де знання не є пасивними" | **Replace** → додати BLOOM-визначення, позначити "Digital Garden" як deprecated alias |
| `docs/product/МОДЕЛЬ_ДОСТУПУ.md` | Заголовок | "Модель доступу Digital Garden" | **Replace** → "Модель доступу BLOOM Runtime" |
| `docs/product/МОДЕЛЬ_ДОСТУПУ.md` | Останній рядок | "модель доступу Digital Garden exodus.pp.ua" | **Replace** → "модель доступу BLOOM Runtime" |
| `docs/drakon/АНАЛІЗ_ПРОЕКТУ.md` | §0, рядок 114 | "Вставка DRAKON-діаграм у Digital Garden нотатки" | **Replace** → "у behavioral definitions" |
| `docs/drakon/АНАЛІЗ_ПРОЕКТУ.md` | Останній рядок | "описував Garden Bloom як Digital Garden SPA" | **Keep** — historical context, вже позначений як deprecated |
| `src/lib/notes/noteLoader.ts` | Рядок 1 | "Runtime note loader for Digital Garden" | **Replace** → "Runtime loader for behavioral definitions" |
| `src/lib/notes/mockNotes.ts` | Mock data | "Welcome to the Digital Garden", "What is a Digital Garden?" | **Replace** → mock content з BLOOM Runtime семантикою |
| `src/lib/i18n/locales/uk.ts` | ownerAuth.setupTitle | "Ласкаво просимо до Digital Garden" | **Replace** → "Активація середовища BLOOM" |
| `src/lib/i18n/locales/de.ts` | ownerAuth.setupTitle | "Willkommen bei Digital Garden" | **Replace** → "BLOOM Umgebung aktivieren" |

### 2.2 "Knowledge Graph" замість "Execution Graph"

| Файл | Секція | Фрагмент | Рекомендація |
|------|--------|----------|--------------|
| `docs/ІНДЕКС.md` | Рядок 33 | "Граф knowledge graph" | **Replace** → "Execution Graph" |
| `docs/architecture/governance/ІНВАРІАНТИ_ГРАФУ_ЗНАНЬ.md` | Заголовок | "ІНВАРІАНТИ_ГРАФУ_ЗНАНЬ" | **Rename** → `ІНВАРІАНТИ_ГРАФУ_ВИКОНАННЯ.md` або додати alias з поясненням |
| `docs/architecture/КАРТА_ГРАФУ.md` | Заголовок | Якщо згадує "knowledge graph" | **Replace** → "Execution Graph" |
| `docs/GRAPH_CONTRACT.md` | Весь документ | "контракт графу knowledge garden" | **Replace** → "контракт execution graph" |
| `src/lib/notes/mockNotes.ts` | Рядок 76 | "personal knowledge graph" | **Replace** → "execution graph" |

### 2.3 "Notes / Нотатки" замість "Behavioral Definitions"

| Файл | Секція | Фрагмент | Рекомендація |
|------|--------|----------|--------------|
| `docs/backend/КОНТРАКТИ_API_V1.md` | Endpoint | `notes/violin.pp.ua/...` | **Keep** — API path; додати коментар що `notes/` є legacy alias для behavioral definitions |
| `docs/architecture/governance/КАНОНІЗАЦІЯ_МОВИ.md` | Рядок 51 | "Пов'язані нотатки" | **Replace** → "Пов'язані документи" |
| `docs/product/МОДЕЛЬ_ДОСТУПУ.md` | Рядки 40, 49, 54 | "Notes", "notes" | **Replace** → "Behavioral Definitions" або "Визначення" |

### 2.4 "Login / Welcome / Увійти до саду" (заборонені UX терміни)

| Файл | Секція | Фрагмент | Рекомендація |
|------|--------|----------|--------------|
| `docs/frontend/BLOOM_AUTH_UI_SPEC.md` | §3 | Вже містить заборону — ✅ коректно | **Keep** |
| `src/hooks/useOwnerAuth.tsx` | Function names | `login()`, `logout()` | **Low risk** — internal code; канонічні UX-терміни на рівні UI, не API |
| `src/lib/i18n/types.ts` | ownerAuth | `loginTitle`, `loginDescription` | **Replace** → `activateTitle`, `activateDescription` |
| `docs/product/МОДЕЛЬ_ДОСТУПУ.md` | Рядок 106 | "POST /auth/login" | **Keep** — API path; окремо від UX-термінів |

### 2.5 "Garden Seedling" замість "Garden Bloom"

| Файл | Секція | Фрагмент | Рекомендація |
|------|--------|----------|--------------|
| `docs/architecture/governance/КАНОНІЗАЦІЯ_МОВИ.md` | Рядок 10 | "Garden Seedling" | **Replace** → "Garden Bloom" |
| `docs/backend/КОНТРАКТИ_API_V1.md` | Останній рядок | "Garden Seedling" | **Replace** → "Garden Bloom" |

---

## 3. Класифікація дій

### Категорія A — Критичні заміни (порушують canonical identity)
- Всі згадки "Digital Garden" як primary identity → BLOOM Runtime / Execution Platform
- "Garden Seedling" → "Garden Bloom"
- UX-терміни у i18n: "Digital Garden" → BLOOM

### Категорія B — Семантичні заміни (покращують консистентність)
- "Knowledge Graph" → "Execution Graph"
- "Нотатки" → "Behavioral Definitions" (де контекст = execution, а не документація)
- Заголовки секцій "Пов'язані нотатки" → "Пов'язані документи"

### Категорія C — Збереження з коментарями (historical/legacy)
- API paths `/notes/`, `/auth/login` — legacy-сумісні, додати пояснювальні коментарі
- Маніфест — може зберегти "Agentic Digital Garden" як historical origin з поясненням
- Mock data — замінити при наступній ітерації UI

### Категорія D — Без змін
- Internal code function names (`login()`, `logout()`) — не UX-видимі
- Файли в `_quarantine/` — ізольовані, не canonical
- `docs/architecture/historical/` — архівні, не canonical

---

## 4. Ризики

| Ризик | Оцінка | Мітігація |
|-------|--------|-----------|
| Зламані crosslinks при перейменуванні файлів | Medium | Перейменовувати з alias, оновлювати посилання |
| Конфлікт з опублікованим Obsidian vault | Low | src/site/notes/ — окрема публікація |
| Зміни в API paths | High | НЕ змінювати API paths; лише додати коментарі |
| Терміни в маніфесті — philosophy vs execution | Medium | Зберегти з поясненням historical origin |

---

## 5. Diff Summary

| Дія | Кількість файлів | Деталі |
|-----|-------------------|--------|
| Replace terminology (docs/) | ~12 | "Digital Garden" → BLOOM, "Knowledge Graph" → Execution Graph |
| Replace terminology (src/) | ~5 | i18n locales, mockNotes, noteLoader |
| Rename files | 1 | ІНВАРІАНТИ_ГРАФУ_ЗНАНЬ → ІНВАРІАНТИ_ГРАФУ_ВИКОНАННЯ (опційно) |
| Add comments | ~3 | API paths — legacy alias annotations |
| No changes | ~20 | Historical, quarantine, internal code |

---

## Семантичні зв'язки

**Цей документ залежить від:**
- [[BLOOM_RUNTIME_IDENTITY]] — canonical execution identity
- [[КАНОНІЗАЦІЯ_МОВИ]] — мовна норма

**Пов'язані документи:**
- [[МАТРИЦЯ_ТЕРМІНІВ_ТА_ЗАМІН]] — канонічний словник замін
- [[ПРОГАЛИНИ_ТА_ПЛАН_ЗАПОВНЕННЯ]] — план закриття прогалин

---

*Цей аудит фіксує стан термінологічної відповідності станом на 2026-02-24.*
