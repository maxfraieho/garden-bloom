# Canonical Node State

A node is **correctly configured** when all of the following are true:

## Checklist

1. `ctx` is available in `PATH` and runs without error:
   ```bash
   ctx doctor
   # Expected: each item shows [OK], final line "Environment: READY" or "PARTIAL"
   # Broken only if chub or cgc are missing from PATH
   ```

2. `~/.claude/hooks/unified-skill-hook.sh` exists and is executable:
   ```bash
   test -x ~/.claude/hooks/unified-skill-hook.sh && echo OK
   ```

3. `~/.claude/hooks/ctx-workflow-policy.sh` exists and is executable:
   ```bash
   test -x ~/.claude/hooks/ctx-workflow-policy.sh && echo OK
   ```

4. `~/.claude/hooks/UserPromptSubmit` exists and is executable:
   ```bash
   test -x ~/.claude/hooks/UserPromptSubmit && echo OK
   ```

5. `~/.claude/settings.json` registers both `UserPromptSubmit` hooks:
   ```bash
   jq '.hooks.UserPromptSubmit | length' ~/.claude/settings.json
   # Expected: 2 (or more, if machine-local hooks are also registered)
   ```

6. `~/.claude/skills/claude-codex-workflow.md` exists:
   ```bash
   test -f ~/.claude/skills/claude-codex-workflow.md && echo OK
   ```

## Verification via bloom-node-bootstrap

`bloom-node-bootstrap` ships a `doctor.sh` script that checks all of the above
in one pass and reports `[OK]` / `[WARN]` / `[FAIL]` for each item.

Run it on any node to verify the installation:
```bash
/path/to/bloom-node-bootstrap/doctor.sh
```

A passing doctor run confirms the node is ready to use the claude-codex-workflow.

## What "PARTIAL" means from ctx doctor

`ctx doctor` reports `PARTIAL` (not `BROKEN`) when `chub` and `cgc` are on PATH
but some secondary checks fail (e.g. `chub stats` returned non-zero, or
`~/.chub` directory is missing). The workflow can still run in degraded mode;
context gathering may return partial or empty results.

`BROKEN` means `chub` or `cgc` are not on PATH — the workflow cannot run until
those tools are installed.
