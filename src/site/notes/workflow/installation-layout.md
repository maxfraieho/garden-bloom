# Installation Layout

This document describes where each file from the `claude-codex-workflow` repo lands
on a target machine after installation.

## File mapping

| File in repo | Target path on node |
|---|---|
| `bin/ctx` | `/usr/local/bin/ctx` (or `~/.local/bin/ctx`) |
| `hooks/ctx-workflow-policy.sh` | `~/.claude/hooks/ctx-workflow-policy.sh` |
| `hooks/unified-skill-hook.sh` | `~/.claude/hooks/unified-skill-hook.sh` |
| `hooks/UserPromptSubmit` | `~/.claude/hooks/UserPromptSubmit` |
| `skill.md` | `~/.claude/skills/claude-codex-workflow.md` |
| `config/settings.template.json` | used to patch `~/.claude/settings.json` |

## Notes

- `bin/ctx` must be executable (`chmod +x`) and available in `PATH`.
- All hook files under `hooks/` must be executable (`chmod +x`).
- `skill.md` is renamed to `claude-codex-workflow.md` at the install target so the
  Claude CLI can load it by skill name.
- `config/settings.template.json` is a template. The `{{HOOKS_DIR}}` placeholder is
  substituted with the actual hooks directory path (default: `~/.claude/hooks`) during
  installation. The resulting JSON is merged into `~/.claude/settings.json`.

## Automated installation

`bloom-node-bootstrap` automates this entire installation. Running the bootstrap
script on a new node will:
1. Clone (or pull) this repo.
2. Copy `bin/ctx` to the appropriate `bin/` directory on `PATH`.
3. Copy all `hooks/` files to `~/.claude/hooks/`.
4. Copy `skill.md` to `~/.claude/skills/claude-codex-workflow.md`.
5. Patch `~/.claude/settings.json` with the hook registrations.

See `docs/canonical-node-state.md` for the verification checklist after installation.

## Machine-local additions

`bloom-node-bootstrap` may also install additional machine-specific hooks
(e.g. `claude-mem-minio` SessionStart/Stop hooks) into `~/.claude/hooks/` and
register them in `~/.claude/settings.json`. These are intentionally NOT included
in this repo — they are machine-local and node-specific.
