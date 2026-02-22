---
tags:
  - domain:frontend
  - status:canonical
  - format:report
created: 2026-02-22
updated: 2026-02-22
title: "Graph Folder Clustering V1"
dg-publish: true
---

# Graph Folder Clustering V1

## Approach

Nodes are color-coded by their **root folder** (first path segment of the slug). This provides visual grouping without altering graph data or layout physics.

- `exodus.pp.ua/agents/...` → folder `exodus.pp.ua`
- `violin.pp.ua/...` → folder `violin.pp.ua`
- Top-level notes → folder `_root`

## Implementation

1. `getRootFolder(slug)` — pure function in `src/lib/notes/linkGraph.ts`:
   - Decodes URI-encoded slug
   - Splits by `/`
   - Returns first segment, or `'_root'` for top-level notes
2. `buildFolderColorMap(nodes)` — deterministic sorted assignment from 8-color palette
3. Node `<circle>` fill uses folder color instead of uniform `--primary`
4. Legend shows folder→color mapping (max 8 shown, "+N more" for overflow)

## Stability Criteria

- **Deterministic:** Folders are sorted alphabetically before color assignment → same slug set always produces same mapping
- **No randomness:** No `Math.random()` in color logic
- **Render-stable:** `folderColorMap` is wrapped in `useMemo(filteredNodes)` — only recalculated when node set changes
- **Focus/active preserved:** Focused node gets glow ring + accent stroke regardless of folder color

## Root Folder Determination

```typescript
export function getRootFolder(slug: string): string {
  const decoded = decodeURIComponent(slug);
  const parts = decoded.split('/');
  if (parts.length <= 1) return '_root';
  return parts[0];
}
```

## Color Palette (8 colors)

```typescript
const FOLDER_COLORS = [
  'hsl(var(--primary))',          // theme primary
  'hsl(var(--accent-foreground))', // theme accent
  'hsl(210 70% 55%)',             // blue
  'hsl(150 60% 45%)',             // green
  'hsl(30 80% 55%)',              // orange
  'hsl(280 60% 55%)',             // purple
  'hsl(350 65% 55%)',             // red
  'hsl(180 50% 45%)',             // teal
];
```

First 2 colors use semantic tokens (adapt to theme), remaining 6 are stable HSL values with sufficient contrast in both light and dark modes.

## Legend Behavior

- Shows max 8 folder entries with color swatch + name
- `_root` displayed as `(root)`
- If > 8 folders: shows "+N more" suffix
- Located in bottom bar alongside edge type legend

## Constraints

- No performance impact: color lookup is O(1) via Map
- Focus/highlight states preserved: focused node still gets glow ring + accent stroke
- Edge filter + search + isolation unaffected

## Files Changed

- `src/lib/notes/linkGraph.ts` — `getRootFolder()` export
- `src/components/garden/GlobalGraphView.tsx` — `buildFolderColorMap()`, `getNodeColor()`, folder legend
