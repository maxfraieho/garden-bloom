---
name: doc-indexer
description: Use when creating or updating _INDEX.md files for documentation directories, auditing link coverage, or ensuring every doc directory has a proper navigation index. Apply after adding new docs, after renames, or during periodic knowledge base audits.
---

# Doc Indexer

## When to use

- After adding new docs to a directory
- After renaming or deprecating docs
- When auditing a knowledge base for orphan nodes
- When creating a new docs directory

## _INDEX.md structure

```markdown
---
tags:
  - domain:<value>
  - status:canonical
  - format:reference
created: YYYY-MM-DD
updated: YYYY-MM-DD
tier: 2
title: "<Directory> — Індекс"
---

# <Directory> — Індекс

> Короткий опис що міститься в цій директорії.

## Документи

| Документ | Призначення | Статус |
|----------|-------------|--------|
| [[DOC_NAME]] | one-line purpose | status |

## Семантичні зв'язки

**Цей індекс є частиною:**
- [[PARENT_INDEX_OR_ROOT]]
```

## Orphan detection

Check: does each doc have at least 1 inbound link?

```bash
# Find potential orphans: docs not referenced anywhere
for f in *.md; do
  name="${f%.md}"
  if ! grep -r "\[\[$name\]\]" ../ --include="*.md" -q; then
    echo "ORPHAN: $f"
  fi
done
```

## After rename

1. `grep -r "[[OLD_NAME]]" . --include="*.md"` — find all references
2. Replace all occurrences with `[[NEW_NAME]]`
3. Update all `_INDEX.md` files that listed OLD_NAME
4. Add `legacy_name: "OLD_NAME.md"` to renamed file frontmatter

## Coverage metrics

A healthy knowledge base has:
- Every directory with `_INDEX.md`
- Every doc with ≥1 inbound link (or `isolated:intentional`)
- Every _INDEX.md links to all docs in its directory
- No stale links (old names after renames)
