---
name: runbook-skills-stack-deployment-v1
description: Runbook for deploying and maintaining the BLOOM skills stack for Claude Code
---

# Runbook: Skills Stack Deployment V1

> Created: 2026-03-15
> Scope: ~/.claude/skills/ — global skill stack for Claude Code on this machine
> Status: canonical operational runbook

---

## What is installed

### Required skills (installed 2026-03-15)

| Skill | Path | Purpose |
|-------|------|---------|
| `using-superpowers` | `~/.claude/skills/using-superpowers/` | Mandatory skill-check workflow at conversation start |
| `verification-before-completion` | `~/.claude/skills/verification-before-completion/` | Evidence-before-claims gate |
| `codex` | `~/.claude/skills/codex/` | Codex-first delegation workflow, gate triggers, SIGSEGV workaround |
| `obsidian-markdown` | `~/.claude/skills/obsidian-markdown/` | BLOOM knowledge base conventions (wiki-links, frontmatter, tags) |

### Desired skills (installed 2026-03-15)

| Skill | Path | Purpose |
|-------|------|---------|
| `documentation-review` | `~/.claude/skills/documentation-review/` | Doc review checklist (accuracy, language, links, structure) |
| `doc-indexer` | `~/.claude/skills/doc-indexer/` | _INDEX.md creation, orphan detection, link hygiene |
| `skill-audit` | `~/.claude/skills/skill-audit/` | Audit skill quality (structure, metadata, instructions) |

### Pre-existing skills (not modified)

`using-superpowers`, `verification-before-completion`, `claude-codex-workflow.md` (bare file), `codex-usage-policy.md` (bare file), + all standard Anthropic skills (algorithmic-art, ast-grep, brainstorming, etc.)

---

## Installation location

All skills global: `~/.claude/skills/<skill-name>/SKILL.md`

Skills are **NOT** placed in project `.claude/skills/` — they are workflow-wide, not project-specific.

---

## How to verify after install

```bash
# 1. Check directories exist
ls ~/.claude/skills/ | grep -E "codex|obsidian|documentation-review|doc-indexer|skill-audit"

# 2. Check SKILL.md present and has content
for s in codex obsidian-markdown documentation-review doc-indexer skill-audit; do
  lines=$(wc -l < ~/.claude/skills/$s/SKILL.md 2>/dev/null || echo 0)
  echo "[$s] $lines lines"
done

# 3. Skills visible to Claude: check system-reminder in any session
# Claude will list all available skills including new ones
```

Expected output: each skill ≥ 50 lines.

---

## How to update a skill

```bash
# Edit SKILL.md directly
nano ~/.claude/skills/<skill-name>/SKILL.md

# No restart needed — Claude reads skills fresh each session
```

---

## How to rollback

```bash
# Remove skill folder
rm -rf ~/.claude/skills/<skill-name>/

# Verify removed
ls ~/.claude/skills/ | grep <skill-name>  # should return nothing
```

---

## How to add new skills

1. Create folder: `mkdir ~/.claude/skills/<new-skill>/`
2. Create SKILL.md with frontmatter:
   ```yaml
   ---
   name: <new-skill>
   description: Use when... [specific trigger condition]
   ---
   ```
3. Add instructions (≥10 lines minimum)
4. Run skill-audit to verify:
   ```bash
   wc -l ~/.claude/skills/<new-skill>/SKILL.md
   grep "^name:\|^description:" ~/.claude/skills/<new-skill>/SKILL.md
   ```
5. Update this runbook

---

## Deployment method used (2026-03-15)

- **Pass 1 (Codex)**: `codex exec` created 5 skill folder stubs (SKILL.md with frontmatter only) — exit 0, no crash
- **Pass 2 (shell script)**: `/tmp/fill_skills.sh` filled content via `cat > file << 'EOF'` heredocs — Claude architect, script executor
- Codex did NOT SIGSEGV this session (Unicode was in Python args previously, not shell heredocs)

---

## Hook integration (no changes made)

Existing hooks (`unified-skill-hook.sh`, mem-pull/push) are preserved.
The `unified-skill-hook.sh` already fires on `UserPromptSubmit` and handles skill routing.

For docs canonicalization tasks, these skills auto-evaluate:
- `writing-plans` — before implementation plan
- `executing-plans` — for batch execution
- `obsidian-markdown` — when working with site/notes/
- `documentation-review` — before marking doc canonical
- `verification-before-completion` — before any completion claim
- `codex` — when bulk file edits are needed

No hook changes required — the unified-skill-hook.sh trigger covers all cases via description matching.

---

## Skill audit summary (2026-03-15)

| Category | Count | Notes |
|----------|-------|-------|
| OK (≥10 lines, valid metadata) | 39 | All standard + new skills |
| STUB (template-skill) | 1 | Intentional — reference template |
| Container dirs (no SKILL.md) | 2 | commands/, document-skills/ — expected |
| FALSE POSITIVE | 1 | skill-audit shows "Replace with" in example text, not in description |
