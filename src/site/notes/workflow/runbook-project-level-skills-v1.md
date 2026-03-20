---
name: runbook-project-level-skills-v1
description: Runbook for project-level skill placement across BLOOM repos
---

# Runbook: Project-Level Skills V1

> Created: 2026-03-15
> Scope: .claude/skills/ placement across BLOOM project repos
> Status: canonical operational runbook

---

## Canonical source model

```
claude-codex-workflow repo (github.com/maxfraieho/claude-codex-workflow)
  └── skills/                    ← canonical source for all custom skills
          ↓ install/sync
~/.claude/skills/                ← global runtime install
          ↓ subset copy
project/.claude/skills/          ← project-level (per-repo relevant subset)
```

**Single source of truth**: `claude-codex-skill/skills/`.
Project repos contain **copies** of the global skills. When the canonical source is updated, project copies must be manually re-synced.

---

## Skills placement map

| Skill | Global | claude-codex-workflow | BLOOMfront | bloom-node-bootstrap | Level |
|-------|--------|-----------------------|------------|----------------------|-------|
| `using-superpowers` | ✅ | ✅ (exists) | — | — | GLOBAL_ONLY |
| `verification-before-completion` | ✅ | ✅ (exists) | ✅ | ✅ | PROJECT_REQUIRED |
| `codex` | ✅ | ✅ | ✅ | ✅ | PROJECT_REQUIRED |
| `obsidian-markdown` | ✅ | ✅ | ✅ | — | PROJECT_REQUIRED (docs repos) |
| `documentation-review` | ✅ | ✅ | ✅ | — | PROJECT_REQUIRED (docs repos) |
| `doc-indexer` | ✅ | ✅ | ✅ | — | PROJECT_REQUIRED (docs repos) |
| `skill-audit` | ✅ | ✅ | — | — | GLOBAL_ONLY |

### Level definitions

- **GLOBAL_ONLY** — workflow-wide, not project-specific; only in `~/.claude/skills/`
- **PROJECT_REQUIRED** — must be in project repo `.claude/skills/` for Claude to apply it in project context
- **BOOTSTRAP_MANAGED** — installed globally by bloom-node-bootstrap workflow component

---

## Current state (2026-03-15)

### claude-codex-workflow (`/home/vokov/claude-codex-skill/`)

`.claude/skills/` does not exist — skills live in `skills/` (canonical source).

Added to `skills/`:
- `codex/` — Codex delegation workflow, gate triggers, SIGSEGV workaround
- `obsidian-markdown/` — BLOOM knowledge base conventions
- `documentation-review/` — doc review checklist
- `doc-indexer/` — _INDEX.md creation, orphan detection
- `skill-audit/` — skill quality audit

### BLOOMfront (`/home/vokov/projects/BLOOMfront/`)

`.claude/skills/` exists. Added folder-based skills alongside legacy `.md` skills:
- `obsidian-markdown/`
- `documentation-review/`
- `doc-indexer/`
- `verification-before-completion/`
- `codex/`

Legacy bare `.md` skills (component-builder, custom-agents, documentation, react-debugger, react-planner, reporting, skillz-integration) — preserved, Lovable-owned.

### bloom-node-bootstrap (`/home/vokov/projects/bloom-node-bootstrap/`)

Created `.claude/skills/` from scratch. Added:
- `codex/`
- `verification-before-completion/`

---

## How to sync when canonical source changes

```bash
# 1. Update canonical source
nano /home/vokov/claude-codex-skill/skills/<skill-name>/SKILL.md
git -C /home/vokov/claude-codex-skill add skills/<skill-name> && git -C /home/vokov/claude-codex-skill commit -m "skills: update <skill-name>" && git -C /home/vokov/claude-codex-skill push

# 2. Sync global install
cp -r /home/vokov/claude-codex-skill/skills/<skill-name> ~/.claude/skills/

# 3. Sync project repos (for each repo that has this skill)
cp -r ~/.claude/skills/<skill-name> /home/vokov/projects/BLOOMfront/.claude/skills/
git -C /home/vokov/projects/BLOOMfront add .claude/skills/<skill-name> && git -C /home/vokov/projects/BLOOMfront commit -m "chore: sync skill <skill-name>"
```

---

## How to add a new skill to a project

1. Create skill in canonical source:
   ```bash
   mkdir /home/vokov/claude-codex-skill/skills/<new-skill>
   # write SKILL.md
   git -C /home/vokov/claude-codex-skill add skills/<new-skill> && git commit + push
   ```

2. Install globally:
   ```bash
   cp -r /home/vokov/claude-codex-skill/skills/<new-skill> ~/.claude/skills/
   ```

3. Add to project (if PROJECT_REQUIRED):
   ```bash
   cp -r ~/.claude/skills/<new-skill> /path/to/project/.claude/skills/
   git add + commit + push
   ```

4. Update this runbook and `ІНВЕНТАР_PROJECT_SKILLS_V1.md`

---

## Hook/policy notes

- Existing `unified-skill-hook.sh` (UserPromptSubmit) handles global skill routing
- Project-level skills are visible to Claude when working in that project directory
- No conflict between global and project-level: project-level takes precedence locally
- No hook changes required — the unified hook covers all cases

---

## Codex deployment method (2026-03-15)

- **Pass 1** (`claude-codex-skill`): Codex exec exit 0 — added 5 skills to `skills/`, committed, pushed
- **Pass 2** (`BLOOMfront`): Codex exec exit 0 — added 5 folder-based skills, committed
- **Pass 3** (`bloom-node-bootstrap`): Codex exec exit 0 — created `.claude/skills/`, added 2 skills + `docs/skills-mapping.md`, committed
- No Codex crashes — no fallback needed
