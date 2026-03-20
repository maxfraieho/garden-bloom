---
name: documentation-review
description: Use when reviewing documentation for clarity, correctness, completeness, and consistency. Apply before marking any doc as canonical, after significant content changes, or when auditing a knowledge base. Covers factual accuracy, language consistency, link hygiene, and structural completeness.
---

# Documentation Review

## Review checklist

### 1. Factual accuracy
- [ ] Content matches current code/system state
- [ ] API contracts reflect actual implementation
- [ ] Status fields are accurate (canonical vs needs-update vs historical)
- [ ] Dates are correct (created, updated)

### 2. Language consistency
- [ ] Title matches document language
- [ ] h1 header matches document language
- [ ] No mixed-language paragraphs (only code blocks, technical identifiers allowed in EN)
- [ ] Technical terms use approved glossary (BLOOM, membridge, DiffMem, DRAKON)

### 3. Structural completeness
- [ ] Frontmatter has all required fields (domain:, status:, format:, tier:, title:)
- [ ] Doc has ≥2 outbound wiki-links
- [ ] Doc has ≥1 inbound wiki-link (or isolated:intentional)
- [ ] Canonical docs have "Семантичні зв'язки" section
- [ ] h1 matches title: field

### 4. Link hygiene
- [ ] No broken wiki-links (targets exist)
- [ ] No stale wiki-links (old filenames after renames)
- [ ] Links serve navigation or explanatory purpose (not link spam)

### 5. Classification correctness
- [ ] Factual docs not misclassified as planned
- [ ] Historical docs not presented as current
- [ ] Deprecated docs have deprecated_by: field

## Review output format

```
## Review: <FILENAME>

**Status**: PASS | FAIL | NEEDS-UPDATE

**Issues found:**
- [FACTUAL] <issue>
- [LANGUAGE] <issue>
- [STRUCTURE] <issue>
- [LINKS] <issue>

**Actions required:**
1. <action>
```

## Severity levels

- **CRITICAL**: Incorrect factual content (outdated API, wrong status)
- **HIGH**: Missing required frontmatter, broken links, wrong language
- **MEDIUM**: Missing semantic links, incomplete classification
- **LOW**: Style inconsistencies, minor formatting
