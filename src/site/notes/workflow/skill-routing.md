# Skill Routing

## Why routing matters

Loading all 47 skills into every prompt is wasteful. Instead:
- `skills/manifest.json` — always available, compact index
- Full skill text — loaded on demand for top-N relevant skills only

## Usage

### Quick shortlist
```
ctx skills "your task description"
```

### Full text of top skills
```
ctx skills --full "your task description"
```

### Machine-readable
```
ctx skills --json "your task description"
```

## How routing works

### Phase A — Router
1. Query tokenized to lowercase words
2. Each skill scored: count of query words in (id + summary + keywords)
3. Top-5 skills returned as shortlist

### Phase B — Expansion (--full only)
- Full text of top-3 skills loaded from skills/ directory
- First 50 lines per skill

## Integration with hooks

The `ctx-workflow-policy.sh` hook can call `ctx skills` to get a dynamic
shortlist instead of hardcoding the full skill list. This keeps prompts
lightweight and routing systematic.

## Updating the manifest

If you add or modify skills:
```
cd ~/path/to/claude-codex-workflow
python3 skills/build_manifest.py
git add skills/manifest.json
git commit -m "chore: rebuild skills manifest"
```
