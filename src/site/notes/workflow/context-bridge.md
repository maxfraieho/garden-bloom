# Context Bridge (ctx)

## What ctx is

`ctx` is a thin CLI wrapper that calls `chub` and `cgc` as subprocesses, trims their output to a usable size, and returns a structured context bundle in JSON or Markdown. It is not a framework, daemon, or memory layer. It is the single command that replaces the manual step of running `chub search` and `cgc search` separately before building a Codex prompt.

## What ctx does not do

- Does not run as a daemon or background process
- Does not interpret, summarize, or rewrite tool output
- Does not replace `chub` or `cgc` — it only calls them
- Does not store any state between invocations
- Does not make architectural decisions

## Install / Path

`ctx` lives at `bin/ctx` inside this repo. It is not on `PATH` by default. Invoke it as:

```bash
python3 /home/vokov/claude-codex-skill/bin/ctx <mode> "<query>"
```

Or add the `bin/` directory to PATH:

```bash
export PATH="$PATH:/home/vokov/claude-codex-skill/bin"
```

---

## ctx doctor

`ctx doctor` checks the local environment and reports the status of each dependency.

```bash
ctx doctor
```

### Checks performed

| Check | What it verifies |
|-------|-----------------|
| chub on PATH | `shutil.which("chub")` finds the binary |
| cgc on PATH | `shutil.which("cgc")` finds the binary |
| ctx on PATH | `shutil.which("ctx")` or falls back to repo path |
| ~/.chub exists | The chub data directory is initialized |
| chub stats runs | `chub stats` exits 0 |
| cgc runnable | `cgc --help` exits 0 |
| skill installed | `~/.claude/skills/claude-codex-workflow.md` exists |
| repo accessible | `/home/vokov/claude-codex-skill` directory exists |

### Output format

```
[OK]   chub on PATH: /home/vokov/.local/bin/chub
[OK]   cgc on PATH: /home/vokov/.local/bin/cgc
[WARN] ctx not on PATH (invoke as: python3 /home/vokov/claude-codex-skill/bin/ctx)
[OK]   ~/.chub directory exists
[OK]   chub stats: ok
[OK]   cgc runnable
[OK]   skill installed: ~/.claude/skills/claude-codex-workflow.md
[OK]   repo accessible: /home/vokov/claude-codex-skill

Environment: PARTIAL
```

### Summary status

| Status | Meaning |
|--------|---------|
| `READY` | All checks passed |
| `PARTIAL` | Some WARNs but chub and cgc are both on PATH |
| `BROKEN` | chub or cgc not on PATH — ctx cannot function |

### Exit codes (doctor)

- `0`: READY or PARTIAL (environment usable)
- `1`: BROKEN (chub or cgc missing)

### When to run doctor

- Before starting feature/bugfix/refactor work in a new environment
- When ctx output shows unexpected warnings
- After installing or reinstalling chub or cgc

---

## Modes

| Mode | Uses chub | Uses cgc | When to use |
|------|-----------|----------|-------------|
| `feature` | yes | yes | Implementing new functionality |
| `bugfix` | yes | yes | Debugging, tracing failures, error context |
| `refactor` | yes | yes | Before touching existing code |
| `docs` | yes | no | Docs-only tasks; cgc never called |

---

## Flags

| Flag | Description |
|------|-------------|
| `--repo PATH` | Run `cgc index <PATH>` before searching; index failure is noted but does not stop the bundle |
| `--output json\|md` | Output format (default: `json`) |
| `--docs-only` | Skip cgc entirely; only chub runs |
| `--code-only` | Skip chub entirely; only cgc runs |
| `--limit N` | Take first N lines from each tool output (default: 50) |

---

## Output Schema (JSON)

```json
{
  "mode": "feature | bugfix | refactor | docs",
  "query": "search query string",
  "docs_context": "raw chub output string, or null if unavailable",
  "code_context": "raw cgc output string, or null if unavailable",
  "notes": [
    "informational: tool ran but exited non-zero while still producing output"
  ],
  "warnings": [
    "serious: tool not found, timed out, or produced no output at all"
  ],
  "summary": "Context bundle: <mode> -- <query>"
}
```

### notes vs warnings

- **warnings**: something is wrong — tool not found, timeout, or zero useful output. The corresponding context field will be `null`.
- **notes**: tool ran and produced output but had a non-zero exit code. Output is still returned and usable.

---

## Exit Codes (bundle modes)

| Code | Meaning |
|------|---------|
| `0` | Success — no warnings, context gathered |
| `1` | Partial — warnings present, but at least one context field is non-null |
| `2` | Nothing gathered — both `docs_context` and `code_context` are null |

---

## Graceful Degradation

`ctx` never crashes if a tool is missing. It degrades gracefully:

| Situation | Behavior |
|-----------|----------|
| `chub` not on PATH | `docs_context: null`, warning added, cgc still runs |
| `cgc` not on PATH | `code_context: null`, warning added, chub still runs |
| Tool times out | Context set to null, warning added, other tool still runs |
| Tool exits non-zero but produced output | Output returned, note added (not warning) |
| `docs` mode, cgc missing | No problem — cgc is never called in docs mode |
| `--docs-only` flag | No problem — cgc is skipped intentionally |
| `--code-only` flag | No problem — chub is skipped intentionally |

Partial bundles (one context null, one non-null) are still returned and useful.

---

## When to use ctx vs direct tools

| Situation | Tool |
|-----------|------|
| Preparing context before Codex delegation | `ctx feature/bugfix/refactor` |
| Docs-only task with no code involvement | `ctx docs` |
| You know exactly which doc you want | `chub get <id>` directly |
| You need a Cypher query or precise symbol | `cgc query "..."` directly |
| Fully greenfield task, no existing docs or code | Neither — Claude defines scope, delegates directly |

---

## Using the output in Claude prompts

Run `ctx` before building the Codex prompt. Paste `docs_context` and `code_context` into Claude's "Context gathered by Claude" section:

```text
Context gathered by Claude:
- Docs context from chub: <paste docs_context from ctx>
- Code context from cgc: <paste code_context from ctx>
```

---

## Examples

```bash
# Verify environment first
ctx doctor

# Feature: docs + code context
ctx feature "add payment webhook handler" --repo /srv/app/billing

# Bugfix: markdown output for easy reading
ctx bugfix "cache refresh returns 500 on cold start" --repo /srv/app/inventory --output md

# Docs-only task
ctx docs "webhook retries and idempotency"

# Refactor with size limit
ctx refactor "split invoice service from webhook controller" --repo /srv/app --limit 20

# Feature, skip cgc
ctx feature "add auth middleware" --docs-only
```
