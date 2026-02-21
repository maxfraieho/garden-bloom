---
{"title":"LOVABLE_AGENT_PROMPT_UA","dg-publish":true,"dg-metatags":null,"dg-home":null,"permalink":"/exodus.pp.ua/drakon/LOVABLE_AGENT_PROMPT_UA/","dgPassFrontmatter":true,"noteIcon":""}
---

# LOVABLE_AGENT_PROMPT_UA — Покроковий промт для агента-інтегратора

**Дата:** 2026-02-07
**Призначення:** Фінальна детальна інструкція для Lovable dev агента для інтеграції DrakonWidget у Garden Bloom
**Мова документа:** Українська
**Використовувані Claude Skills:** react-planner, component-builder, react-debugger, /audit, /review

---

## Vendor DrakonWidget (локальні файли в repo)

### Runtime файл
- **Шлях у public:** `public/libs/drakonwidget.js`
- **Джерело:** `vendor/drakonwidget/libs/drakonwidget.js`
- **Розмір:** ~1.4 MB (unminified)

### Спосіб завантаження
npm-пакет **НЕ використовується**, оскільки `package.json` віджета містить некоректний `"main": "index.js"` (файл не існує).

Замість цього — динамічне підключення script:
```javascript
await loadScript('/libs/drakonwidget.js');
// Після завантаження доступна глобальна функція window.createDrakonWidget()
```

### Vendor директорія
- **Повна копія repo:** `vendor/drakonwidget/` (без `.git`)
- **Використовується лише:** `vendor/drakonwidget/libs/drakonwidget.js` → скопійовано у `public/libs/`

### Demo-файли НЕ використовуються
Наступні файли є лише демонстраційними і **НЕ повинні** використовуватися в інтеграції:
- `vendor/drakonwidget/styles/main.css`
- `vendor/drakonwidget/styles/reset.css`
- `vendor/drakonwidget/js/main.js`
- `vendor/drakonwidget/js/examples.js`
- `vendor/drakonwidget/index.html`

### Додаткові бібліотеки (НЕ потрібні для MVP)
- `vendor/drakonwidget/libs/simplewidgets.js` — замінюється shadcn-ui
- `vendor/drakonwidget/libs/mousetrap.min.js` — опціонально для keyboard shortcuts (Phase 2+)
- `vendor/drakonwidget/libs/rounded.js` — лише для demo

---

## РОЛЬ АГЕНТА

Ти — **Lovable Dev Agent**, що працює з проєктом **garden-bloom** (React 18 + Vite 5 + TypeScript 5 + shadcn-ui + Tailwind CSS).

Твоя задача: інтегрувати бібліотеку **DrakonWidget** (vanilla JavaScript widget для DRAKON-діаграм) у проєкт, слідуючи існуючим Claude Skills:
- **react-planner** — для планування
- **component-builder** — для створення компонентів
- **react-debugger** — при проблемах
- **/audit** та **/review** — для перевірки якості

**ВАЖЛИВО:** Дотримуйся Ownership Protocol з `.claude/CLAUDE.md`:
- Lovable відповідає за: UI/UX, JSX структуру, shadcn компоненти
- Claude відповідає за: Logic, types, validation, utilities, security
- При конфлікті → explicit user decision required

---

## ДОРОЖНЯ КАРТА

### MVP (Phase 1) — Read-only DRAKON Viewer
- Відображення DRAKON діаграм у нотатках
- Markdown синтаксис `:::drakon id="...":::`
- Lazy loading drakonwidget.js
- Dark/light theme support
- Responsive resize

### Beta (Phase 2) — Interactive Editor
- Режим редагування діаграм (для owner)
- Збереження змін
- Export (PNG/JSON)
- Undo/Redo
- Context menu integration

### Production (Phase 3) — Full Integration
- i18n переклади для DRAKON UI
- Access zone integration
- Performance optimization
- Повний /audit та /review

---

## PHASE 1: MVP — READ-ONLY VIEWER

### Крок 1.1: Підготовка TypeScript типів

**Використати:** component-builder skill (Interface Design)

**Створити файл:** `src/types/drakonwidget.d.ts`

```typescript
// src/types/drakonwidget.d.ts

/**
 * TypeScript declarations for DrakonWidget
 * @see https://github.com/stepan-mitkin/drakonwidget
 */

declare interface DrakonItem {
  type: string;
  content?: string;
  secondary?: string;
  link?: string;
  one?: string;
  two?: string;
  side?: string;
  flag1?: number;
  branchId?: number;
  margin?: number;
  style?: string;
}

declare interface DrakonDiagram {
  name: string;
  access: 'read' | 'write';
  params?: string;
  style?: string;
  items: Record<string, DrakonItem>;
}

declare interface DrakonConfigTheme {
  background?: string;
  backText?: string;
  borderWidth?: number;
  candyBorder?: string;
  candyFill?: string;
  color?: string;
  commentBack?: string;
  iconBack?: string;
  iconBorder?: string;
  icons?: Record<string, Partial<DrakonConfigTheme>>;
  internalLine?: string;
  lines?: string;
  lineWidth?: number;
  scrollBar?: string;
  scrollBarHover?: string;
  shadowBlur?: number;
  shadowColor?: string;
}

declare interface DrakonMenuItem {
  hint?: string;
  text: string;
  action?: () => void;
  type?: 'separator';
  icon?: string;
}

declare interface DrakonEditItem {
  id: string;
  type: string;
  content: string;
  secondary?: string;
  link?: string;
  left: number;
  top: number;
  width: number;
  height: number;
}

declare interface DrakonSelectionItem {
  id: string;
  type: string;
  content: string;
  style?: Record<string, unknown>;
}

declare interface DrakonConfig {
  startEditContent: (item: DrakonEditItem, isReadonly: boolean) => void;
  showContextMenu: (left: number, top: number, items: DrakonMenuItem[]) => void;
  startEditLink?: (item: DrakonEditItem, isReadonly: boolean) => void;
  startEditSecondary?: (item: DrakonEditItem, isReadonly: boolean) => void;
  startEditStyle?: (ids: string[], oldStyle: Record<string, unknown>, x: number, y: number, accepted: Record<string, boolean>) => void;
  startEditDiagramStyle?: (oldStyle: Record<string, unknown>, x: number, y: number) => void;
  onSelectionChanged?: (items: DrakonSelectionItem[] | null) => void;
  onZoomChanged?: (newZoomValue: number) => void;
  translate?: (text: string) => string;
  allowResize?: boolean;
  canSelect?: boolean;
  canvasIcons?: boolean;
  canvasLabels?: string;
  centerContent?: boolean;
  drawZones?: boolean;
  editorWatermark?: boolean;
  font?: string;
  headerFont?: string;
  branchFont?: string;
  iconRadius?: number;
  lineHeight?: number;
  lineRadius?: number;
  maxHeight?: number;
  maxWidth?: number;
  minWidth?: number;
  metre?: number;
  padding?: number;
  textFormat?: 'plain' | 'markdown' | 'html';
  theme?: DrakonConfigTheme;
  branch?: string;
  end?: string;
  exit?: string;
  yes?: string;
  no?: string;
  watermark?: string;
}

declare interface DrakonEditChange {
  id?: string;
  op: 'insert' | 'update' | 'delete';
  fields?: Record<string, unknown>;
}

declare interface DrakonEdit {
  id: string;
  changes: DrakonEditChange[];
}

declare interface DrakonEditSender {
  pushEdit: (edit: DrakonEdit) => void;
  stop: () => void;
}

declare interface DrakonWidget {
  render: (width: number, height: number, config: DrakonConfig) => HTMLElement;
  redraw: () => void;
  setDiagram: (diagramId: string, diagram: DrakonDiagram, editSender: DrakonEditSender) => Promise<string[]>;
  exportJson: () => string;
  exportCanvas: (zoom100: number) => HTMLCanvasElement;
  setContent: (itemId: string, content: string) => string[];
  setSecondary: (itemId: string, content: string) => string[];
  setStyle: (ids: string[], style: Record<string, unknown>) => string[];
  setLink: (itemId: string, link: string) => void;
  setDiagramStyle: (style: Record<string, unknown>) => string[];
  patchDiagramStyle: (style: Record<string, unknown>) => string[];
  setDiagramProperty: (name: string, value: string) => void;
  getDiagramProperties: () => Record<string, unknown>;
  setZoom: (zoomLevel: number) => void;
  getZoom: () => number;
  getVersion: () => string;
  getLoadedImages: () => Record<string, { content: string }>;
  goHome: () => void;
  showItem: (itemId: string) => void;
  showInsertionSockets: (type: string, imageData?: { id: string } | { content: string }) => void;
  showPaste: () => void;
  arrowUp: () => void;
  arrowDown: () => void;
  arrowLeft: () => void;
  arrowRight: () => void;
  copySelection: () => void;
  cutSelection: () => void;
  deleteSelection: () => void;
  editContent: () => void;
  swapYesNo: (id: string) => void;
  toggleSilhouette: () => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  onChange: (change: unknown) => void;
}

declare function createDrakonWidget(): DrakonWidget;

declare global {
  interface Window {
    createDrakonWidget: typeof createDrakonWidget;
  }
}
```

**Верифікація (component-builder checklist):**
- [x] All props typed
- [x] No `any` types
- [x] Return types explicit
- [x] Matches README API documentation

---

### Крок 1.2: Створити adapter для завантаження

**Створити файл:** `src/lib/drakon/adapter.ts`

```typescript
// src/lib/drakon/adapter.ts

let loadPromise: Promise<void> | null = null;

/**
 * Dynamically loads drakonwidget.js script
 * Returns when createDrakonWidget is available on window
 */
export function loadDrakonWidget(): Promise<void> {
  if (window.createDrakonWidget) {
    return Promise.resolve();
  }

  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '/libs/drakonwidget.js';
    script.async = true;

    script.onload = () => {
      if (window.createDrakonWidget) {
        resolve();
      } else {
        reject(new Error('DrakonWidget script loaded but createDrakonWidget not found'));
      }
    };

    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load drakonwidget.js'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

/**
 * Creates a new DrakonWidget instance
 * Must call loadDrakonWidget() first
 */
export function createWidget(): DrakonWidget {
  if (!window.createDrakonWidget) {
    throw new Error('DrakonWidget not loaded. Call loadDrakonWidget() first.');
  }
  return window.createDrakonWidget();
}
```

---

### Крок 1.3: Створити theme adapter

**Створити файл:** `src/lib/drakon/themeAdapter.ts`

```typescript
// src/lib/drakon/themeAdapter.ts

/**
 * Maps garden-bloom theme (dark/light) to DrakonWidget theme
 */
export function getGardenDrakonTheme(isDark: boolean): DrakonConfigTheme {
  if (isDark) {
    return {
      background: '#1e293b',
      iconBack: '#334155',
      iconBorder: '#64748b',
      color: '#f1f5f9',
      lines: '#94a3b8',
      lineWidth: 1,
      shadowColor: 'rgba(0, 0, 0, 0.4)',
      shadowBlur: 4,
      scrollBar: 'rgba(255, 255, 255, 0.2)',
      scrollBarHover: 'rgba(255, 255, 255, 0.5)',
      backText: '#cbd5e1',
    };
  }

  return {
    background: '#f8fafc',
    iconBack: 'white',
    iconBorder: '#94a3b8',
    color: '#1e293b',
    lines: '#475569',
    lineWidth: 1,
    shadowColor: 'rgba(0, 0, 0, 0.12)',
    shadowBlur: 4,
    scrollBar: 'rgba(0, 0, 0, 0.15)',
    scrollBarHover: 'rgba(0, 0, 0, 0.4)',
    backText: '#475569',
  };
}
```

---

### Крок 1.4: Створити types для зберігання діаграм

**Створити файл:** `src/lib/drakon/types.ts`

```typescript
// src/lib/drakon/types.ts

export interface StoredDrakonDiagram {
  version: '1.0';
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  diagram: DrakonDiagram;
}

export interface DrakonBlockParams {
  id: string;
  height?: number;
  mode?: 'view' | 'edit';
  theme?: string;
  zoom?: number;
}

/**
 * Parse :::drakon::: directive from markdown
 */
export function parseDrakonDirective(text: string): DrakonBlockParams | null {
  const match = text.match(
    /^:::drakon\s+((?:\w+="[^"]*"\s*)+):::$/
  );
  if (!match) return null;

  const params: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  let attrMatch: RegExpExecArray | null;
  while ((attrMatch = attrRegex.exec(match[1])) !== null) {
    params[attrMatch[1]] = attrMatch[2];
  }

  if (!params.id) return null;

  return {
    id: params.id,
    height: params.height ? parseInt(params.height, 10) : 400,
    mode: (params.mode as 'view' | 'edit') || 'view',
    theme: params.theme || 'auto',
    zoom: params.zoom ? parseInt(params.zoom, 10) : 10000,
  };
}
```

---

### Крок 1.5: Створити компонент DrakonViewer

**Використати:** component-builder skill

**Створити файл:** `src/components/garden/DrakonViewer.tsx`

```typescript
// src/components/garden/DrakonViewer.tsx

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadDrakonWidget, createWidget } from '@/lib/drakon/adapter';
import { getGardenDrakonTheme } from '@/lib/drakon/themeAdapter';

interface DrakonViewerProps {
  diagram: DrakonDiagram;
  diagramId: string;
  height?: number;
  initialZoom?: number;
  className?: string;
}

export function DrakonViewer({
  diagram,
  diagramId,
  height = 400,
  initialZoom = 10000,
  className,
}: DrakonViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<DrakonWidget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  // No-op edit sender for read-only mode
  const editSender: DrakonEditSender = {
    pushEdit: () => {},
    stop: () => {},
  };

  // Build config
  const buildConfig = useCallback((): DrakonConfig => ({
    startEditContent: () => {},
    showContextMenu: () => {},
    canSelect: false,
    canvasIcons: false,
    textFormat: 'markdown',
    theme: getGardenDrakonTheme(isDark),
  }), [isDark]);

  // Initialize widget
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!containerRef.current) return;

      try {
        await loadDrakonWidget();
        if (!mounted) return;

        const widget = createWidget();
        widgetRef.current = widget;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        container.innerHTML = '';

        const config = buildConfig();
        const element = widget.render(rect.width, rect.height, config);
        container.appendChild(element);

        await widget.setDiagram(diagramId, diagram, editSender);
        widget.setZoom(initialZoom);

        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load diagram');
        setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      if (widgetRef.current) {
        editSender.stop();
        widgetRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [diagramId]); // Re-init only when diagram changes

  // Handle theme changes
  useEffect(() => {
    if (!widgetRef.current || !containerRef.current || isLoading) return;

    const widget = widgetRef.current;
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();

    container.innerHTML = '';
    const config = buildConfig();
    const element = widget.render(rect.width, rect.height, config);
    container.appendChild(element);
    widget.redraw();
  }, [isDark, buildConfig, isLoading]);

  // Handle resize
  useEffect(() => {
    if (!containerRef.current || !widgetRef.current || isLoading) return;

    const container = containerRef.current;
    const widget = widgetRef.current;

    let resizeTimeout: ReturnType<typeof setTimeout>;

    const observer = new ResizeObserver(() => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (!container || !widget) return;
        const rect = container.getBoundingClientRect();
        container.innerHTML = '';
        const config = buildConfig();
        const element = widget.render(rect.width, rect.height, config);
        container.appendChild(element);
        widget.redraw();
      }, 200);
    });

    observer.observe(container);

    return () => {
      clearTimeout(resizeTimeout);
      observer.disconnect();
    };
  }, [isLoading, buildConfig]);

  if (error) {
    return (
      <div className={cn(
        'flex items-center justify-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive',
        className
      )} style={{ height }}>
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg"
          style={{ height }}
        >
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      <div
        ref={containerRef}
        className="drakon-container rounded-lg border overflow-hidden"
        style={{ height, minHeight: 200 }}
      />
    </div>
  );
}
```

---

### Крок 1.6: Створити компонент DrakonDiagramBlock

**Створити файл:** `src/components/garden/DrakonDiagramBlock.tsx`

```typescript
// src/components/garden/DrakonDiagramBlock.tsx

import { Suspense, lazy, useState, useEffect } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DrakonBlockParams } from '@/lib/drakon/types';

// Lazy load the viewer
const DrakonViewer = lazy(() =>
  import('./DrakonViewer').then(m => ({ default: m.DrakonViewer }))
);

interface DrakonDiagramBlockProps {
  params: DrakonBlockParams;
  noteSlug: string;
  className?: string;
}

export function DrakonDiagramBlock({
  params,
  noteSlug,
  className,
}: DrakonDiagramBlockProps) {
  const [diagram, setDiagram] = useState<DrakonDiagram | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDiagram() {
      try {
        // Phase 1: Load from static JSON file
        const response = await fetch(
          `/site/notes/${noteSlug}/diagrams/${params.id}.drakon.json`
        );
        if (!response.ok) {
          throw new Error(`Diagram not found: ${params.id}`);
        }
        const stored = await response.json();
        setDiagram(stored.diagram || stored);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load diagram');
      }
    }

    loadDiagram();
  }, [params.id, noteSlug]);

  if (error) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 p-3',
        className
      )}>
        <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="text-sm text-amber-700 dark:text-amber-300">
          DRAKON: {error}
        </span>
      </div>
    );
  }

  if (!diagram) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border bg-muted/30"
        style={{ height: params.height || 400 }}
      >
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Suspense
      fallback={
        <div
          className="flex items-center justify-center rounded-lg border bg-muted/30"
          style={{ height: params.height || 400 }}
        >
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DrakonViewer
        diagram={diagram}
        diagramId={params.id}
        height={params.height}
        initialZoom={params.zoom}
        className={className}
      />
    </Suspense>
  );
}
```

---

### Крок 1.7: Інтеграція в NoteRenderer

**Змінити файл:** `src/components/garden/NoteRenderer.tsx`

Додати обробку `:::drakon:::` блоків у `transformContent()`:

```typescript
// ДОДАТИ імпорт
import { parseDrakonDirective } from '@/lib/drakon/types';
import { DrakonDiagramBlock } from './DrakonDiagramBlock';

// ДОДАТИ маркер
const DRAKON_MARKER_REGEX = /%%DRAKON:([^%]+)%%/g;

// ЗМІНИТИ transformContent — додати обробку :::drakon:::
function transformContent(content: string): string {
  // Existing wikilink transform...
  let transformed = content.replace(wikilinkRegex, (match, target, alias) => {
    // ... existing code ...
  });

  // NEW: Transform :::drakon::: directives to markers
  transformed = transformed.replace(
    /^:::drakon\s+([^:]+):::$/gm,
    (match, attrs) => {
      return `%%DRAKON:${encodeURIComponent(attrs.trim())}%%`;
    }
  );

  return transformed;
}

// ДОДАТИ в components всередині NoteRenderer:
// У components object додати обробку параграфів з DRAKON маркерами
p: ({ children, ...props }) => {
  // Check if this paragraph contains a DRAKON marker
  if (typeof children === 'string' && children.startsWith('%%DRAKON:')) {
    const match = children.match(/^%%DRAKON:([^%]+)%%$/);
    if (match) {
      const attrs = decodeURIComponent(match[1]);
      const params = parseDrakonDirective(`:::drakon ${attrs}:::`);
      if (params) {
        return (
          <DrakonDiagramBlock
            params={params}
            noteSlug={note.slug}
            className="my-4"
          />
        );
      }
    }
  }
  // Existing processing...
  const processedChildren = processChildren(children);
  return <p {...props}>{processedChildren}</p>;
},
```

---

### Крок 1.8: Скопіювати drakonwidget.js

**Дія:** Скопіювати файл `drakonwidget.js` до public/

```bash
cp vendor/drakonwidget/libs/drakonwidget.js public/libs/drakonwidget.js
```

**Додати до `.gitignore`:**
```
# DrakonWidget vendor (якщо не хочемо в git)
# public/libs/drakonwidget.js
```

---

### Крок 1.9: CSS ізоляція

**Додати стилі** у `src/index.css` або окремий файл:

```css
/* DrakonWidget container isolation */
.drakon-container {
  isolation: isolate;
  position: relative;
  font: 14px Arial;
  line-height: 1.3;
  contain: layout style;
}

.drakon-container * {
  box-sizing: content-box;
}

.drakon-container canvas {
  display: block;
}

.drakon-container .icon-container em {
  font-style: italic;
}

.drakon-container .icon-container strong {
  font-weight: bold;
}
```

---

### Крок 1.10: Верифікація MVP

**Використати:** /review command

```bash
npm run build     # Перевірити TypeScript
npm run lint      # Перевірити ESLint
```

**Тест у браузері:**
1. Створити тестову діаграму в `src/site/notes/test/diagrams/demo.drakon.json`
2. Додати `:::drakon id="demo" height="500":::` у markdown нотатку
3. Перевірити рендеринг
4. Перевірити dark/light theme switching
5. Перевірити responsive resize

---

## PHASE 2: BETA — INTERACTIVE EDITOR

### Крок 2.1: DrakonEditor компонент

**Створити файл:** `src/components/garden/DrakonEditor.tsx`

```typescript
// src/components/garden/DrakonEditor.tsx

import { useRef, useEffect, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { Loader2, AlertCircle, Save, Undo, Redo, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { loadDrakonWidget, createWidget } from '@/lib/drakon/adapter';
import { getGardenDrakonTheme } from '@/lib/drakon/themeAdapter';
import { toast } from 'sonner';

interface DrakonEditorProps {
  diagram: DrakonDiagram;
  diagramId: string;
  height?: number;
  onSave?: (diagramJson: string) => void;
  className?: string;
}

export function DrakonEditor({
  diagram,
  diagramId,
  height = 500,
  onSave,
  className,
}: DrakonEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<DrakonWidget | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const editSender: DrakonEditSender = {
    pushEdit: (edit) => {
      setHasChanges(true);
      // Phase 2+: send to backend
      console.log('[DrakonEditor] Edit:', edit);
    },
    stop: () => {},
  };

  const buildConfig = useCallback((): DrakonConfig => ({
    startEditContent: (item, isReadonly) => {
      if (isReadonly) return;
      const newContent = prompt('Edit content:', item.content);
      if (newContent !== null && widgetRef.current) {
        widgetRef.current.setContent(item.id, newContent);
      }
    },
    showContextMenu: (left, top, items) => {
      // Phase 2: shadcn-ui ContextMenu
      console.log('[DrakonEditor] Context menu:', { left, top, items });
    },
    canSelect: true,
    canvasIcons: false,
    textFormat: 'markdown',
    theme: getGardenDrakonTheme(isDark),
    onSelectionChanged: (items) => {
      console.log('[DrakonEditor] Selection:', items);
    },
  }), [isDark]);

  // Initialize (same pattern as DrakonViewer)
  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!containerRef.current) return;
      try {
        await loadDrakonWidget();
        if (!mounted) return;

        const widget = createWidget();
        widgetRef.current = widget;
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        container.innerHTML = '';

        const config = buildConfig();
        const element = widget.render(rect.width, rect.height, config);
        container.appendChild(element);

        await widget.setDiagram(diagramId, diagram, editSender);
        setIsLoading(false);
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Failed to load editor');
        setIsLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
      editSender.stop();
      widgetRef.current = null;
      if (containerRef.current) containerRef.current.innerHTML = '';
    };
  }, [diagramId]);

  const handleSave = useCallback(() => {
    if (!widgetRef.current) return;
    const json = widgetRef.current.exportJson();
    onSave?.(json);
    setHasChanges(false);
    toast.success('Діаграму збережено');
  }, [onSave]);

  const handleUndo = useCallback(() => {
    widgetRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    widgetRef.current?.redo();
  }, []);

  const handleExportPng = useCallback(() => {
    if (!widgetRef.current) return;
    try {
      const canvas = widgetRef.current.exportCanvas(10000);
      const link = document.createElement('a');
      link.download = `${diagramId}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('PNG exported');
    } catch {
      toast.error('Export requires canvasIcons mode');
    }
  }, [diagramId]);

  if (error) {
    return (
      <div className={cn(
        'flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4',
        className
      )} style={{ height }}>
        <AlertCircle className="h-5 w-5 text-destructive" />
        <span className="text-sm text-destructive">{error}</span>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={!hasChanges || isLoading}
        >
          <Save className="h-4 w-4 mr-1" />
          Зберегти
        </Button>
        <Button variant="ghost" size="sm" onClick={handleUndo} disabled={isLoading}>
          <Undo className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" onClick={handleRedo} disabled={isLoading}>
          <Redo className="h-4 w-4" />
        </Button>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={handleExportPng} disabled={isLoading}>
          <Download className="h-4 w-4 mr-1" />
          PNG
        </Button>
      </div>

      {/* Widget */}
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/50 rounded-lg z-10" style={{ height }}>
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          ref={containerRef}
          className="drakon-container rounded-lg border overflow-hidden"
          style={{ height, minHeight: 300 }}
        />
      </div>
    </div>
  );
}
```

---

### Крок 2.2: Hook для діаграм

**Створити файл:** `src/hooks/useDrakonDiagram.ts`

```typescript
// src/hooks/useDrakonDiagram.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { StoredDrakonDiagram } from '@/lib/drakon/types';

export function useDrakonDiagram(noteSlug: string, diagramId: string) {
  return useQuery<StoredDrakonDiagram>({
    queryKey: ['drakon-diagram', noteSlug, diagramId],
    queryFn: async () => {
      const response = await fetch(
        `/site/notes/${noteSlug}/diagrams/${diagramId}.drakon.json`
      );
      if (!response.ok) throw new Error('Diagram not found');
      return response.json();
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSaveDrakonDiagram(noteSlug: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ diagramId, json }: { diagramId: string; json: string }) => {
      // Phase 2: Save via API
      // For now, log to console
      console.log(`[useSaveDrakonDiagram] Save ${diagramId}:`, json);
      return { success: true };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['drakon-diagram', noteSlug, variables.diagramId],
      });
    },
  });
}
```

---

## PHASE 3: PRODUCTION

### Крок 3.1: Повна i18n інтеграція

Додати ключі `drakon` у кожен файл локалізації:
- `src/lib/i18n/locales/uk.ts`
- `src/lib/i18n/locales/en.ts`
- `src/lib/i18n/locales/fr.ts`
- `src/lib/i18n/locales/de.ts`
- `src/lib/i18n/locales/it.ts`

### Крок 3.2: Access Zone інтеграція

В `DrakonDiagramBlock.tsx` додати перевірку auth:
```typescript
const { isAuthenticated } = useOwnerAuth();
const effectiveMode = isAuthenticated ? params.mode : 'view';
```

### Крок 3.3: Performance optimization

1. Intersection Observer для lazy mount
2. Diagram caching через React Query
3. Preload script на hover

### Крок 3.4: /audit

Запустити повний аудит:
- Type Safety
- Security (XSS через content)
- Performance (bundle size)
- Consistency (naming, patterns)

### Крок 3.5: /review

Фінальний code review перед merge.

---

## ТЕСТОВА ДІАГРАМА

Створити файл для тестування:

**Файл:** `src/site/notes/test-drakon/diagrams/demo.drakon.json`

```json
{
  "version": "1.0",
  "id": "demo",
  "name": "Demo Diagram",
  "createdAt": "2026-02-07T00:00:00Z",
  "updatedAt": "2026-02-07T00:00:00Z",
  "diagram": {
    "name": "Demo Process",
    "access": "read",
    "items": {
      "1": { "type": "end" },
      "2": { "type": "branch", "branchId": 0, "one": "3" },
      "3": { "type": "action", "content": "Початок процесу", "one": "4" },
      "4": { "type": "question", "content": "Чи все OK?", "one": "5", "two": "6" },
      "5": { "type": "action", "content": "Продовжити", "one": "1" },
      "6": { "type": "action", "content": "Виправити помилку", "one": "4" }
    }
  }
}
```

**Markdown нотатка:** `src/site/notes/test-drakon/index.md`

```markdown
---
title: "Тест DRAKON діаграми"
tags: ["test", "drakon"]
---

# Тест DRAKON інтеграції

Ось приклад вбудованої DRAKON діаграми:

:::drakon id="demo" height="400" mode="view":::

Діаграма показує простий процес з розгалуженням.
```

---

## ФІНАЛЬНИЙ ЧЕКЛИСТ

- [ ] TypeScript declarations створено (`src/types/drakonwidget.d.ts`)
- [ ] Adapter створено (`src/lib/drakon/adapter.ts`)
- [ ] Theme adapter створено (`src/lib/drakon/themeAdapter.ts`)
- [ ] Types створено (`src/lib/drakon/types.ts`)
- [ ] DrakonViewer компонент створено
- [ ] DrakonDiagramBlock компонент створено
- [ ] NoteRenderer розширено для :::drakon:::
- [ ] drakonwidget.js скопійовано до public/libs/
- [ ] CSS ізоляція додана
- [ ] Тестова діаграма створена
- [ ] `npm run build` проходить
- [ ] `npm run lint` проходить
- [ ] Dark/light theme працює
- [ ] Responsive resize працює
- [ ] DrakonEditor компонент створено (Phase 2)
- [ ] useDrakonDiagram hook створено (Phase 2)
- [ ] i18n ключі додано у 5 мов (Phase 3)
- [ ] Access zone інтеграція (Phase 3)
- [ ] /audit пройдено (Phase 3)
- [ ] /review пройдено (Phase 3)
