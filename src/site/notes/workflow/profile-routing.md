# Profile-Aware Context Routing

## What it is

`ctx skills` and `ctx context` route to relevant skills based on a prompt and a **profile**. The profile adjusts scoring so that constrained or specialized environments get a shortlist tuned for their context.

This is not a whitelist/blacklist. Every skill stays accessible — profiles change the scoring weights, not the set of available skills.

---

## Profiles

### `default`
General development work. All skills scored at base weight 1.0 unless the skill itself overrides.

### `rpi`
Raspberry Pi and other constrained-hardware nodes. Designed for bootstrap, recovery, and debugging workflows where:
- Resource pressure is real (low RAM, slow CPU, no GPU)
- Install/bootstrap/recovery tasks are the primary use case
- Heavy frontend, creative, and cloud-native skills are rarely relevant

**rpi boosts** (weight > 1.0, these surface higher in results):
- `systematic-debugging` (1.5) — hardware and software failures are common
- `root-cause-tracing` (1.5) — deep failures need tracing
- `condition-based-waiting` (1.4) — timing issues common on slow hardware
- `defense-in-depth` (1.4) — validation at every layer matters more with less margin
- `executing-plans` (1.4) — running install/bootstrap plans step-by-step
- `verification-before-completion` (1.4) — verify before claiming done, especially on hardware
- `test-driven-development` (1.3) — test-first reduces rework on slow iteration cycles
- `writing-plans` (1.3) — planning before execution is more valuable when recovery is costly

**rpi suppresses** (weight < 1.0, these surface lower or not at all):
- Frontend/React/UI skills (0.4) — rarely needed on headless nodes
- Creative/visual/art skills (0.1–0.3) — not relevant for infrastructure work
- `dispatching-parallel-agents` (0.7) — parallel subagents are expensive on constrained hardware
- `subagent-driven-development` (0.7) — same reason

---

## Profile detection order

1. `--profile` argument (highest priority)
2. `CTX_PROFILE` environment variable
3. `default` (fallback)

```bash
# Explicit argument
ctx skills --profile rpi "debug broken install"

# Via env var
export CTX_PROFILE=rpi
ctx skills "debug broken install"

# Default (no argument, no env var)
ctx skills "implement new feature"
```

---

## Commands

### `ctx skills`

Returns a shortlist of relevant skills for a prompt.

```
ctx skills [--profile PROFILE] [--json] [--full] [--top N] QUERY
```

| Flag | Description |
|------|-------------|
| `--profile PROFILE` | Profile to use (`default`, `rpi`). Defaults to `$CTX_PROFILE` or `default`. |
| `--json` | Machine-readable JSON output |
| `--full` | Include full skill metadata (tags, description) in JSON |
| `--top N` | Return top N skills (default: 5) |

**Text output:**
```
Profile: rpi
Query: debug broken install

Top 5 skills:
  1. systematic-debugging  [score: 6.0] (rpi weight: 1.5)
     Four-phase framework for debugging...
  2. root-cause-tracing  [score: 4.5] (rpi weight: 1.5)
     ...
```

**JSON output:**
```json
{
  "profile": "rpi",
  "profile_source": "argument",
  "query": "debug broken install",
  "top": 5,
  "skills": [
    {"name": "systematic-debugging", "score": 6.0, "category": "debugging"},
    ...
  ]
}
```

### `ctx context`

Returns a full context bundle: profile + skill shortlist + placeholder sections for future docs/commands/config routing.

```
ctx context [--profile PROFILE] [--json] [--top N] QUERY
```

Same flags as `ctx skills`. Output includes:
- `profile` — resolved profile name
- `profile_source` — how it was resolved (`argument`, `CTX_PROFILE`, `default`)
- `profile_description` — human description of the profile
- `skills` — scored shortlist
- `docs` — future: relevant docs/runbooks (currently empty)
- `commands` — future: relevant slash commands (currently empty)
- `config` — future: relevant config entries (currently empty)

---

## Routing algorithm

1. Tokenize the prompt into lowercase words, then expand wordforms to canonical forms (normalization).
2. For each skill, compute `raw_score`:
   - `+2` for each prompt token that matches a tag in `skill.tags` (tags are also normalized)
   - `+1` for each prompt token that appears in the skill's `use_cases` text
3. Apply `profile_weight`: `final_score = raw_score × profile_weights[profile]`
4. Sort descending by `final_score`, return top N with `raw_score > 0`.

Skills with zero raw score are excluded entirely (not affected by profile weight).

### Token normalization

Wordform variants expand to canonical forms so routing doesn't break on inflections:

| Variants | Canonical |
|----------|-----------|
| `failed`, `failure`, `failing` | `fail` |
| `installer`, `installing`, `installation` | `install` |
| `debugging`, `debugged` | `debug` |
| `recovery`, `recovering` | `recover` |
| `verification`, `verified` | `verify` |
| `implementation`, `implementing` | `implement` |
| `deployment`, `deploying` | `deploy` |
| `bootstrapping` | `bootstrap` |

Both the original token and canonical form are in the token set. Tags are normalized the same way.

For full details: `docs/context-routing.md`

---

## Context artifacts

Non-skill artifacts (docs, commands, config hooks) are defined in `skills/context_artifacts.json`. Each entry has:

```json
{
  "name": "ctx-context-bridge",
  "type": "doc",
  "path": "~/claude-codex-skill/docs/context-bridge.md",
  "description": "...",
  "tags": ["ctx", "context", "debug", "feature", ...],
  "profile_weights": {"default": 1.0, "rpi": 1.4}
}
```

**Types**:
- `doc` — markdown docs, skill files, runbooks
- `command` — slash commands in `~/.claude/commands/`
- `config` — hooks in `~/.claude/hooks/`

`ctx context` scores artifacts using the same keyword overlap algorithm as skills and returns them in `docs`, `commands`, `config` sections of the bundle.

The `rpi` profile boosts workflow/debugging docs (1.3–1.4×) and suppresses nothing in artifacts — everything is potentially relevant for bootstrap/recovery work.

---

## Manifests

Skills are defined in `skills/manifest.json`. Structure:

```json
{
  "manifest_version": "2.0",
  "profiles": {
    "default": {"description": "..."},
    "rpi": {"description": "..."}
  },
  "skills": [
    {
      "name": "systematic-debugging",
      "description": "...",
      "category": "debugging",
      "tags": ["debug", "bug", "failure", "error", ...],
      "use_cases": ["debugging test failures", ...],
      "profile_weights": {
        "default": 1.0,
        "rpi": 1.5
      }
    }
  ]
}
```

To validate: `python3 skills/build_manifest.py`

To list all skills: `python3 skills/build_manifest.py --list`

To show profile weights: `python3 skills/build_manifest.py --profiles`

---

## Hook integration

`~/.claude/hooks/unified-skill-hook.sh` (the active `UserPromptSubmit` hook) is already integrated with profile-aware routing:

1. **Skill list** — loaded dynamically from `skills/manifest.json` at hook execution time. No hardcoded list. Falls back to embedded array if manifest is unavailable.

2. **Pre-evaluation shortlist** — generated by `ctx context --profile "$CTX_PROFILE" --json "$PROMPT"`. The result appears in the hook output as:
   ```
   PRE-EVALUATION [profile: rpi, source: ctx-context]:
     ✓ systematic-debugging
     ✓ root-cause-tracing
     ...
   ```

3. **Profile** — read from `CTX_PROFILE` env var. Set it on RPi:
   ```bash
   # In ~/.bashrc or systemd service environment
   export CTX_PROFILE=rpi
   ```

4. **LLM fallback** — set `CTX_PREFER_LLM=1` to use the Anthropic API for pre-evaluation instead of `ctx context`. This is the legacy behavior; `ctx context` is the default.

### Degradation paths

| Failure | Behavior |
|---------|----------|
| manifest missing | Falls back to embedded `FALLBACK_SKILLS` array |
| `ctx context` fails/times out | Pre-evaluation section omitted silently; full skills list still shown |
| `CTX_PROFILE` unset | Uses `default` profile |
| Unknown `CTX_PROFILE` value | `ctx context` exits with error; hook omits pre-evaluation |

To manually test the hook integration:
```bash
echo '{"prompt": "debug broken install", "cwd": "/tmp"}' \
  | CTX_PROFILE=rpi bash ~/.claude/hooks/unified-skill-hook.sh
```

---

## Adding a new profile

1. Add the profile entry to `skills/manifest.json` under `"profiles"`:
   ```json
   "cloud-minimal": {
     "description": "Cloud VM with minimal footprint..."
   }
   ```
2. Add `"cloud-minimal": <weight>` to `profile_weights` in each relevant skill.
3. Run `python3 skills/build_manifest.py` to validate.
4. Test: `ctx skills --profile cloud-minimal "deploy service"`

Profiles not present in a skill's `profile_weights` fall back to the `default` weight for that skill.

---

## Examples

```bash
# Debug on RPi — surfaces debugging skills
ctx skills --profile rpi "debug broken install"

# General feature work — default routing
ctx skills --profile default "implement feature"

# Deploy context bundle in JSON for hook use
ctx context --profile rpi --json "recover failed bootstrap"

# Unknown profile — clear error
ctx skills --profile unknown "something"
# error: unknown profile 'unknown'. Known profiles: default, rpi

# Via env var
CTX_PROFILE=rpi ctx skills "installer failed midway"

# Build manifest validation
python3 skills/build_manifest.py
```
