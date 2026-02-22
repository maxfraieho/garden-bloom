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

1. `getFolderFromSlug(slug)` extracts root folder from decoded slug
2. `folderColorMap` (useMemo) assigns stable colors from an 8-color palette
3. Node `<circle>` fill uses folder color instead of uniform `--primary`
4. Legend shows folder→color mapping (max 8 shown, "+N more" for overflow)

## Constraints

- No performance impact: color lookup is O(1) via Map
- Focus/highlight states preserved: focused node still gets glow ring + accent stroke
- Edge filter + search + isolation unaffected
- Palette uses 2 semantic tokens + 6 HSL values for sufficient contrast in both themes

## Files Changed

- `src/components/garden/GlobalGraphView.tsx` — folder extraction, color mapping, legend
