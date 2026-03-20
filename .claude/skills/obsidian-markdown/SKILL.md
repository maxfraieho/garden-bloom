---
name: obsidian-markdown
description: Use when working with Obsidian-flavored Markdown in the BLOOM knowledge base (src/site/notes/). Covers wiki-links, frontmatter requirements, tag taxonomy, language canon, file naming conventions, and link hygiene rules specific to this project.
---

# Obsidian Markdown — BLOOM Conventions

## Wiki-links

Correct format: `[[FILENAME]]` or `[[FILENAME|display text]]`
FORBIDDEN: `[[TARGET\|ALIAS]]` — breaks the JS wiki-link parser

Orphan docs (no inbound links): must have `isolated: intentional` in frontmatter OR add at least 1 inbound link.
Every canonical doc must have ≥2 outbound wiki-links.

## Frontmatter requirements

```yaml
---
tags:
  - domain:<value>     # REQUIRED
  - status:<value>     # REQUIRED
  - format:<value>     # REQUIRED
created: YYYY-MM-DD    # REQUIRED
updated: YYYY-MM-DD    # REQUIRED (update on every significant change)
tier: 1|2             # REQUIRED
title: "Ukrainian title"  # REQUIRED, must match document language
---
```

## Tag taxonomy

**domain:** arch | runtime | memory | frontend | backend | meta | integration | migration | ops

**status:** canonical | historical | draft | deprecated | planned | needs-update

**format:** spec | guide | contract | audit | inventory | reference

**Legacy fields after rename:** add `legacy_name: "OLD_FILENAME.md"` + `deprecated_by:` (if deprecated)

## File naming

- Default: `UPPER_SNAKE_CASE.md` in Ukrainian
- Exceptions (stay as-is): product names (BLOOM_RUNTIME_*, MEMBRIDGE_*), workflow/ dir (lowercase-kebab-case), PROJECT_DESCRIPTION_CANONICAL.md
- After rename: update ALL wiki-links in base + _INDEX.md

## Language canon

- Ukrainian = canonical language for all docs
- English allowed only for: product names (BLOOM, membridge, DiffMem, DRAKON), technical identifiers, API/CLI/JSON/YAML, env vars, code blocks
- `title:` in frontmatter must match document language
- h1 header must match document language

## Tier classification

- **Tier 1**: canonical specs (top-level architectural truth, ~27 files)
- **Tier 2**: operational/derivative docs (reference, runbooks, guides)

## Semantic links section

Every canonical doc must end with:
```markdown
## Семантичні зв'язки

**Цей документ є частиною:**
- [[PARENT_DOC]]

**Цей документ залежить від:**
- [[DEPENDENCY]]

**Від цього документа залежать:**
- [[DEPENDENT]]
```

## Audit classification

| Code | Status | Action |
|------|--------|--------|
| FACTUAL_CANONICAL | status:canonical | No change |
| FACTUAL_NEEDS_UPDATE | status:needs-update | Tag + audit |
| PLANNED_PROPOSAL | status:planned/draft | Relabel only |
| HISTORICAL_AUDIT | status:historical | Preserve, don't update |
| DUPLICATE_MERGE_CANDIDATE | status:deprecated | Add deprecated_by: |
| ORPHAN_NEEDS_LINKING | — | Add inbound link or isolated:intentional |
