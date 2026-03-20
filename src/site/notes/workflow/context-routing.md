# Context Routing Reference

Full reference for `ctx context`, `ctx skills`, profile-aware routing, token normalization, and artifact indexing.

---

## Overview

`ctx context` and `ctx skills` route to relevant skills and supporting artifacts for a given prompt and **profile**. The routing is keyword-overlap scoring with profile weights — no LLM call, deterministic, instant.

**What you get from `ctx context`:**
- `skills` — top matching skills from `skills/manifest.json`
- `docs` — relevant documentation and runbooks
- `commands` — relevant slash commands (`~/.claude/commands/`)
- `config` — relevant hooks (`~/.claude/hooks/`)

---

## Commands

### `ctx skills`

Shortlist of relevant skills for a prompt.

```
ctx skills [--profile PROFILE] [--json] [--full] [--top N] QUERY
```

### `ctx context`

Full context bundle: profile + skills + docs + commands + config.

```
ctx context [--profile PROFILE] [--json] [--full] [--top N] [--top-artifacts N] QUERY
```

| Flag | Description |
|------|-------------|
| `--profile PROFILE` | Profile to use (`default`, `rpi`). Defaults to `$CTX_PROFILE` or `default`. |
| `--json` | Machine-readable JSON output |
| `--full` | Include full metadata: `raw_score`, `weight`, `matched_keywords`, `description`, `path` |
| `--top N` | Return top N skills (default: 5) |
| `--top-artifacts N` | Return top N artifacts per section (default: 3) |

---

## Routing Algorithm

1. **Tokenize** the prompt: split into lowercase alphanumeric words, then expand wordforms to canonical forms (see normalization below).
2. **Score skills**: for each skill in `manifest.json`:
   - `+2` for each prompt token that matches a tag in `skill.tags`
   - `+1` for each prompt token that appears in `skill.use_cases` text
3. **Score artifacts**: for each artifact in `context_artifacts.json`:
   - `+2` for each prompt token that matches a tag
4. **Apply profile weight**: `final_score = raw_score × profile_weights[profile]`
5. **Sort** descending by `final_score`, return top N (items with `raw_score == 0` excluded).

Tag tokens are also normalized — "installer" in a tag list expands to `{"installer", "install"}` so that a prompt with "install" matches it too.

---

## Token Normalization

Wordform variations are reduced to canonical forms so routing doesn't break on inflections.

**Examples:**

| Prompt word | Canonical form | What it matches |
|-------------|----------------|-----------------|
| `failed`, `failure`, `failing` | `fail` | tags containing `fail` or `failure` |
| `installer`, `installing`, `installation` | `install` | tags containing `install` |
| `debugging`, `debugged` | `debug` | tags containing `debug` |
| `recovery`, `recovering` | `recover` | tags containing `recover` |
| `verification`, `verified` | `verify` | tags containing `verify` |
| `implementation`, `implementing` | `implement` | tags containing `implement` |
| `building`, `built` | `build` | tags containing `build` |
| `deployment`, `deploying` | `deploy` | tags containing `deploy` |
| `bootstrapping` | `bootstrap` | tags containing `bootstrap` |
| `validation`, `validating` | `validate` | tags containing `validate` |
| `configuration`, `configuring` | `configure` | tags containing `configure` |

Both the original token and the canonical form are added to the token set. This means:
- `"installer"` matches both `"installer"` and `"install"` tags
- `"install"` matches both `"install"` and `"installer"` tags (if that exact word is a tag)

---

## Profiles

### `default`

General development work. All skills scored at base weight 1.0 unless the skill overrides.

### `rpi`

Raspberry Pi and other constrained-hardware nodes.

**Boosts** (weight > 1.0):
- `systematic-debugging` (1.5) — hardware and software failures are common
- `root-cause-tracing` (1.5) — deep failures need tracing
- `condition-based-waiting` (1.4) — timing issues on slow hardware
- `defense-in-depth` (1.4) — validation at every layer matters with less margin
- `executing-plans` (1.4) — running install/bootstrap plans step-by-step
- `verification-before-completion` (1.4) — verify before claiming done on hardware
- `test-driven-development` (1.3) — test-first reduces rework on slow iteration cycles
- `writing-plans` (1.3) — planning before execution is more valuable when recovery is costly

**Suppresses** (weight < 1.0):
- Frontend/React/UI skills (0.4) — rarely needed on headless nodes
- Creative/visual/art skills (0.1–0.3) — not relevant for infrastructure work
- `dispatching-parallel-agents` (0.7) — parallel subagents are expensive on constrained hardware
- `subagent-driven-development` (0.7) — same reason

---

## Profile Resolution

1. `--profile` argument (highest priority)
2. `CTX_PROFILE` environment variable
3. `default` (fallback)

```bash
ctx skills --profile rpi "debug broken install"

export CTX_PROFILE=rpi
ctx skills "debug broken install"
```

The resolved `profile_source` is returned in JSON output as `"argument"`, `"CTX_PROFILE"`, or `"default"`.

---

## Data Sources

### `skills/manifest.json`

All skills. Schema per entry:

```json
{
  "name": "systematic-debugging",
  "description": "...",
  "category": "debugging",
  "tags": ["debug", "bug", "failure", "error"],
  "use_cases": ["debugging test failures", "..."],
  "profile_weights": {
    "default": 1.0,
    "rpi": 1.5
  }
}
```

Profiles without an explicit weight in `profile_weights` fall back to `"default"` weight.

Validate: `python3 skills/build_manifest.py`

### `skills/context_artifacts.json`

Non-skill context artifacts (docs, commands, config hooks). Schema per entry:

```json
{
  "name": "ctx-workflow-policy",
  "type": "config",
  "path": "~/.claude/hooks/ctx-workflow-policy.sh",
  "description": "...",
  "tags": ["codex", "workflow", "feature", "debug", "implement"],
  "profile_weights": {"default": 1.0, "rpi": 1.3}
}
```

**Types:**
- `doc` — returned in the `docs` section
- `command` — returned in the `commands` section
- `config` — returned in the `config` section

---

## Debugging Routing

### Transparency tool

```bash
python3 skills/build_manifest.py --debug-query "PROMPT"
python3 skills/build_manifest.py --debug-query "PROMPT" --profile rpi
```

Shows ranked matches with `score`, `raw_score`, `weight`, and matched keywords for every section.

### Manual inspection

```bash
# What tokens is the prompt generating?
python3 -c "
import re, sys
SYNONYMS = {
    'failed': 'fail', 'failure': 'fail', 'failing': 'fail',
    'installer': 'install', 'installing': 'install', 'installation': 'install',
    'debugging': 'debug', 'recovery': 'recover', 'recovering': 'recover',
    'verification': 'verify', 'verifying': 'verify', 'verified': 'verify',
    'implementing': 'implement', 'implementation': 'implement',
}
prompt = ' '.join(sys.argv[1:])
raw = re.findall(r'[a-z0-9]+', prompt.lower())
tokens = set()
for t in raw:
    tokens.add(t)
    c = SYNONYMS.get(t)
    if c:
        tokens.add(c)
print(sorted(tokens))
" debug installer failure
```

### Common issues

**No results / unexpected results:**
1. Check prompt tokens with debug above
2. Verify skill tags include the canonical form (`install`, not `installer`)
3. Run `--debug-query` to see all scores

**Commands section empty:**
Prompt tokens don't match any command artifact tags. Session commands require "session" or workflow words. Command artifacts don't generally match on technical terms — they match on meta-workflow terms.

**rpi weight not applying:**
- Verify `CTX_PROFILE=rpi` is set or `--profile rpi` is passed
- Check `profile_source` field in JSON output
- Verify skill has `"rpi"` key in `profile_weights`

---

## Hook Integration

`~/.claude/hooks/unified-skill-hook.sh` integrates `ctx context` into every prompt:

1. Loads skill list dynamically from `skills/manifest.json` at hook execution time.
2. Calls `ctx context --profile "$CTX_PROFILE" --json "$USER_PROMPT"` for pre-evaluation shortlist.
3. Outputs matched skills before the full skill list, tagged `PRE-EVALUATION [profile: rpi, source: ctx-context]`.

Set `CTX_PROFILE=rpi` in `~/.bashrc` or service environment on RPi nodes.

Test hook directly:
```bash
echo '{"prompt": "debug broken install", "cwd": "/tmp"}' \
  | CTX_PROFILE=rpi bash ~/.claude/hooks/unified-skill-hook.sh
```

**Degradation paths:**

| Failure | Behavior |
|---------|----------|
| `manifest.json` missing | Falls back to embedded `FALLBACK_SKILLS` array |
| `ctx context` fails | Pre-evaluation section omitted; full skill list still shown |
| `CTX_PROFILE` unset | Uses `default` profile |
| Unknown `CTX_PROFILE` | `ctx context` exits 1; hook omits pre-evaluation |

---

## Adding a New Profile

1. Add profile entry to `skills/manifest.json` under `"profiles"`:
   ```json
   "cloud-minimal": {"description": "Cloud VM with minimal footprint"}
   ```
2. Add `"cloud-minimal": <weight>` to `profile_weights` in each relevant skill.
3. Run `python3 skills/build_manifest.py` to validate.
4. Test: `ctx skills --profile cloud-minimal "deploy service"`

---

## Examples

```bash
# Debug on RPi — surfaces debugging skills boosted 1.5×
ctx skills --profile rpi "debug broken install"

# Full context bundle for planning
ctx context --profile rpi --json "recover failed bootstrap"

# Transparency: see exactly what matched and why
python3 skills/build_manifest.py --debug-query "installer failed" --profile rpi

# Validate manifest
python3 skills/build_manifest.py

# List all skills by category
python3 skills/build_manifest.py --list

# Show profile weights summary
python3 skills/build_manifest.py --profiles

# Unknown profile — clear error
ctx skills --profile unknown "something"
# error: unknown profile 'unknown'. Known profiles: default, rpi
```
