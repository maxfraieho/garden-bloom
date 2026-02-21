---
{"tags":["domain:drakon","status:draft","format:guide","feature:logic"],"created":"2026-02-21","updated":"2026-02-21","tier":2,"title":"IMPLEMENTATION_CHECKLIST_UA","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/drakon/IMPLEMENTATION_CHECKLIST_UA/","dgPassFrontmatter":true,"noteIcon":""}
---

# IMPLEMENTATION_CHECKLIST_UA — Definition of Done

**Дата:** 2026-02-07
**Проєкт:** Інтеграція DrakonWidget у Garden Bloom

---

## Phase 1: MVP (Read-only Viewer) — Definition of Done

### Файли створено

- [ ] `src/types/drakonwidget.d.ts` — TypeScript declarations для DrakonWidget API
- [ ] `src/lib/drakon/adapter.ts` — Dynamic script loader + createWidget wrapper
- [ ] `src/lib/drakon/themeAdapter.ts` — Garden dark/light → DrakonWidget theme mapping
- [ ] `src/lib/drakon/types.ts` — StoredDrakonDiagram, DrakonBlockParams, parseDrakonDirective
- [ ] `src/components/garden/DrakonViewer.tsx` — Read-only viewer component
- [ ] `src/components/garden/DrakonDiagramBlock.tsx` — Markdown integration block (lazy)
- [ ] `public/libs/drakonwidget.js` — Vendor copy of drakonwidget library
- [ ] CSS стилі для `.drakon-container` (в index.css або окремому файлі)

### Файли змінено

- [ ] `src/components/garden/NoteRenderer.tsx` — додано обробку `:::drakon:::` blocks
- [ ] `src/components/garden/ZoneNoteRenderer.tsx` — аналогічна підтримка (якщо потрібно)

### Тестові дані

- [ ] `src/site/notes/test-drakon/diagrams/demo.drakon.json` — тестова діаграма
- [ ] Markdown нотатка з `:::drakon id="demo":::` директивою

### Функціональні вимоги

- [ ] DRAKON діаграма рендериться у markdown нотатці
- [ ] Синтаксис `:::drakon id="..." height="..." mode="view":::` працює
- [ ] Lazy loading — drakonwidget.js завантажується тільки при потребі
- [ ] Dark mode — діаграма адаптується до темної теми
- [ ] Light mode — діаграма адаптується до світлої теми
- [ ] Responsive — діаграма змінює розмір при зміні вікна
- [ ] Loading state — показує spinner під час завантаження
- [ ] Error state — показує повідомлення при помилці
- [ ] Діаграма НЕ рендериться якщо файл не знайдено (graceful fallback)

### Якість коду

- [ ] `npm run build` — ZERO TypeScript errors
- [ ] `npm run lint` — ZERO ESLint warnings
- [ ] Всі нові інтерфейси мають явні типи (NO `any`)
- [ ] useEffect має правильний cleanup (memory leak prevention)
- [ ] ResizeObserver properly disconnected on unmount
- [ ] Dynamic script load не дублюється (singleton pattern)

### Performance

- [ ] drakonwidget.js НЕ включено в основний bundle (dynamic load)
- [ ] DrakonViewer та DrakonDiagramBlock використовують React.lazy
- [ ] ResizeObserver debounced (200ms)
- [ ] Діаграми кешуються (React Query або простий cache)

### Security

- [ ] XSS: content з діаграми не вставляється через dangerouslySetInnerHTML
- [ ] drakonwidget.js завантажується тільки з own domain (/libs/)
- [ ] JSON parsing обгорнуто в try/catch
- [ ] Зовнішні URL не генеруються

### CSS ізоляція

- [ ] `.drakon-container` має `isolation: isolate`
- [ ] Tailwind resets не ламають DRAKON рендеринг
- [ ] DRAKON стилі не витікають за контейнер
- [ ] `box-sizing: content-box` всередині контейнера

---

## Phase 2: Beta (Interactive Editor) — Definition of Done

### Файли створено

- [ ] `src/components/garden/DrakonEditor.tsx` — editable DRAKON viewer
- [ ] `src/hooks/useDrakonDiagram.ts` — React Query hook для load/save

### Файли змінено

- [ ] `src/components/garden/DrakonDiagramBlock.tsx` — підтримка mode="edit"

### Функціональні вимоги

- [ ] Owner може перейти в режим редагування діаграми
- [ ] Toolbar: Save, Undo, Redo, Export PNG
- [ ] Content editing працює (click → prompt → save)
- [ ] Context menu відображається
- [ ] Зміни відстежуються (hasChanges state)
- [ ] Export JSON працює
- [ ] Export PNG працює (при canvasIcons=true)
- [ ] Undo/Redo працює через widget API
- [ ] Guest (zone viewer) НЕ може редагувати

### Якість

- [ ] Всі попередні Phase 1 перевірки пройдено
- [ ] editSender.stop() викликається при unmount
- [ ] Повторні рендери не дублюють event listeners
- [ ] Prompt для content editing — тимчасове рішення (Phase 3: shadcn dialog)

---

## Phase 3: Production — Definition of Done

### i18n

- [ ] `src/lib/i18n/types.ts` — додано `drakon` секцію в Translations
- [ ] `src/lib/i18n/locales/uk.ts` — українські переклади
- [ ] `src/lib/i18n/locales/en.ts` — англійські переклади
- [ ] `src/lib/i18n/locales/fr.ts` — французькі переклади
- [ ] `src/lib/i18n/locales/de.ts` — німецькі переклади
- [ ] `src/lib/i18n/locales/it.ts` — італійські переклади
- [ ] DrakonWidget `translate` callback підключено до i18n

### Access Zones

- [ ] Owner authentication перевіряється перед edit mode
- [ ] Zone guests бачать тільки view mode
- [ ] Діаграми за consent gate (якщо зона confidential)
- [ ] MCP endpoint повертає JSON діаграми

### Performance (advanced)

- [ ] Intersection Observer — діаграма рендериться тільки при видимості
- [ ] Preload script on hover over diagram area
- [ ] Diagram data кешується через React Query з staleTime
- [ ] Bundle analysis — drakon chunk < 1.5 MB

### /audit результати

- [ ] Type Safety: усі нові файли відповідають strict TypeScript
- [ ] Security: XSS review пройдено
- [ ] React: hooks правильно використовуються
- [ ] Performance: lazy loading ефективний
- [ ] Consistency: shadcn-ui patterns дотримуються

### /review результати

- [ ] TypeScript — build clean
- [ ] ESLint — lint clean
- [ ] React best practices — дотримуються
- [ ] Tailwind — cn() для умовних класів
- [ ] Код не дублюється
- [ ] Naming conventions дотримуються

### Integration тести (ручні)

- [ ] Створити нову діаграму через Editor
- [ ] Зберегти діаграму
- [ ] Переглянути діаграму в markdown нотатці
- [ ] Перемкнути dark/light theme — діаграма адаптується
- [ ] Змінити розмір вікна — діаграма адаптується
- [ ] Відкрити діаграму в zone view — read-only
- [ ] Перемкнути мову — UI перекладається
- [ ] Зламати JSON діаграми — graceful error
- [ ] Відключити мережу — graceful error на load

---

## Acceptance Criteria (загальні)

### MUST HAVE (блокуючі)
1. DRAKON діаграми відображаються у markdown нотатках
2. Lazy loading працює (не збільшує initial bundle)
3. Dark/light theme працює
4. TypeScript compilation чиста
5. Не ламає існуючий функціонал

### SHOULD HAVE (важливі)
1. Responsive resize
2. Error handling для відсутніх діаграм
3. Editor mode для owner
4. CSS повністю ізольовано

### NICE TO HAVE (бажані)
1. i18n для DRAKON UI
2. Export PNG/JSON
3. Intersection Observer для lazy mount
4. Context menu через shadcn-ui

---

## Rollback Plan

Якщо інтеграція спричиняє проблеми:

1. Видалити зміни з `NoteRenderer.tsx`
2. Видалити `src/components/garden/Drakon*.tsx`
3. Видалити `src/lib/drakon/`
4. Видалити `src/types/drakonwidget.d.ts`
5. Видалити `public/libs/drakonwidget.js`
6. Видалити CSS для `.drakon-container`
7. `:::drakon:::` блоки залишаться як plain text (безпечно)

**Ризик rollback:** НИЗЬКИЙ — зміни ізольовані, не торкаються core функціоналу.

---

## Середовище діагностики (snapshot)

```
ОС: Linux 5.10.236-android12 (aarch64, Termux)
Git: 2.51.1
Node: v24.9.0
npm: 11.6.0
Python: 3.12.12
Утиліти: tar, curl, unzip — доступні
```

---

**Документ завершено. Все готово для передачі агенту-інтегратору.**
