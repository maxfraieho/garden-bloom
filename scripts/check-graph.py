#!/usr/bin/env python3
"""
check-graph.py — Knowledge graph integrity check for docs/

Enforces:
  - I-S1: every doc has "## Семантичні зв'язки" (or isolated:intentional)
  - I-S3/I-S6: every doc has ≥1 inbound wiki-link (or isolated:intentional)
  - I-S5: every doc has ≥2 outbound wiki-links (or isolated:intentional)
  - I-S2: no dangling wiki-links (links to non-existent files)
  - I-S8: no backslash-pipe [[target\|alias]] format (parser-breaking)
  - SMOKE: site graph has ≥50 resolved edges (graph-render smoke test)

Usage:
  python3 scripts/check-graph.py [--verbose] [--ci] [--no-smoke]

Exit codes:
  0 — clean graph
  1 — violations found
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOCS_DIR = ROOT / "docs"
SITE_NOTES_DIR = ROOT / "src" / "site" / "notes"

# Minimum resolved edges required for graph smoke test (I-SMOKE-1)
SMOKE_MIN_EDGES = 50

SKIP_DIR_NAMES: set[str] = {"_quarantine", ".git"}
SKIP_FILE_NAMES: set[str] = {"CLAUDE.md"}

# Files that are exempt from outbound-link minimum (they ARE the maps)
EXEMPT_FROM_OUTBOUND = {"КАРТА_СИСТЕМИ", "КАРТА_ГРАФУ", "ІНДЕКС", "АУДІО_ПРОМПТ_NOTEBOOKLM"}

# Known valid references to external docs (agents/, future docs, etc.) — not in docs/
EXTERNAL_REFS: set[str] = {
    # Integrity agents (live in agents/ folder, not docs/)
    "graph-linter", "semantic-guard", "content-router", "tag-auditor",
    # Template placeholders in governance docs (examples, not real links)
    "somedoc", "wiki-links", "wiki-link", "targetname", "відповідний вузол",
}


def is_excluded(path: Path) -> bool:
    if path.name in SKIP_FILE_NAMES:
        return True
    return any(part in SKIP_DIR_NAMES for part in path.parts)


def strip_code_blocks(text: str) -> str:
    """Remove fenced code blocks and inline code to avoid false-positive link detection."""
    # Remove fenced code blocks (``` ... ```)
    text = re.sub(r"```[\s\S]*?```", "", text)
    # Remove inline code (`...`)
    text = re.sub(r"`[^`\n]+`", "", text)
    return text


def find_backslash_pipe_links(text: str) -> list[str]:
    """Return all [[target\|alias]] links in text (excluding code blocks)."""
    searchable = strip_code_blocks(text)
    # Match any [[...]] where the content contains \|
    raw = re.findall(r"\[\[([^\]]+)\]\]", searchable)
    return [lk for lk in raw if "\\|" in lk]


def parse_metadata(text: str) -> dict:
    searchable = strip_code_blocks(text)
    meta = {
        "is_isolated": "isolated: intentional" in text,
        "has_semantic_links": any(
            s in text for s in ["## Семантичні зв'язки", "## ЗВ'ЯЗКИ", "## ЗВ\\'ЯЗКИ"]
        ),
        # Extract links only from non-code text; skip links with backslash or spaces (template artifacts)
        "outlinks": [
            lk for lk in re.findall(r"\[\[([^\]|#]+?)(?:\|[^\]]+)?\]\]", searchable)
            if "\\" not in lk and "/" not in lk
        ],
        # I-S8: detect backslash-pipe links (Obsidian plugin format, breaks JS parser)
        "backslash_pipe_links": find_backslash_pipe_links(searchable),
    }
    return meta


def run_smoke_test() -> tuple[int, str]:
    """
    Smoke test: count resolved edges in src/site/notes/ using JS parser logic.
    Returns (edge_count, status_message).
    """
    if not SITE_NOTES_DIR.is_dir():
        return -1, f"SKIP — {SITE_NOTES_DIR} not found"

    files = list(SITE_NOTES_DIR.rglob("*.md"))
    # Build stem map (JS filename-fallback resolution)
    stem_map: dict[str, str] = {}
    for p in files:
        stem = p.stem.lower()
        if stem not in stem_map:
            stem_map[stem] = str(p.relative_to(SITE_NOTES_DIR))

    FRONTMATTER_RE = re.compile(r"^---\s*\n[\s\S]*?\n---\s*\n")
    # Canonical link pattern (no backslash, no #): JS parser handles these
    LINK_RE = re.compile(r"\[\[([^\]|#\\]+?)(?:\|[^\]]+)?\]\]")

    resolved = 0
    for p in files:
        text = p.read_text(encoding="utf-8", errors="replace")
        m = FRONTMATTER_RE.match(text)
        body = text[m.end():] if m else text
        body = strip_code_blocks(body)

        for lm in LINK_RE.finditer(body):
            target = lm.group(1).strip().lower()
            # JS fallback: if path, take last segment
            if "/" in target:
                target = target.split("/")[-1]
            if target in stem_map:
                resolved += 1

    status = "OK" if resolved >= SMOKE_MIN_EDGES else "FAIL"
    return resolved, f"{status} — {resolved} resolved edges (min {SMOKE_MIN_EDGES})"


def main() -> int:
    parser = argparse.ArgumentParser(description="Knowledge graph integrity check for docs/")
    parser.add_argument("-v", "--verbose", action="store_true", help="Show passing checks too")
    parser.add_argument("--ci", action="store_true", help="CI mode: no color, structured output")
    parser.add_argument("--no-smoke", action="store_true", help="Skip graph-render smoke test")
    args = parser.parse_args()

    if not DOCS_DIR.is_dir():
        print(f"ERROR: docs/ not found at {DOCS_DIR}", file=sys.stderr)
        return 1

    # Collect all files
    file_data: dict[str, dict] = {}  # stem.lower() → data
    for p in sorted(DOCS_DIR.rglob("*.md")):
        if is_excluded(p):
            continue
        text = p.read_text(encoding="utf-8", errors="replace")
        meta = parse_metadata(text)
        stem = p.stem.lower()
        file_data[stem] = {
            "path": p,
            "rel": str(p.relative_to(DOCS_DIR)),
            "stem": p.stem,
            **meta,
            "inlinks": 0,
            "inlink_from": [],
        }

    # Build inlinks
    for stem, fd in file_data.items():
        for link in fd["outlinks"]:
            target = link.lower()
            if target in file_data and target != stem:
                file_data[target]["inlinks"] += 1
                if fd["rel"] not in file_data[target]["inlink_from"]:
                    file_data[target]["inlink_from"].append(fd["rel"])

    violations: list[tuple[str, str, str]] = []  # (rel, rule_id, message)

    for stem, fd in sorted(file_data.items(), key=lambda x: x[1]["rel"]):
        rel = fd["rel"]
        iso = fd["is_isolated"]

        # I-S1: semantic links section
        if not fd["has_semantic_links"] and not iso:
            violations.append((rel, "I-S1", "missing '## Семантичні зв'язки' section"))

        # I-S6: ≥1 inbound link
        if not iso and fd["inlinks"] == 0:
            violations.append((rel, "I-S6", "orphan — 0 inbound wiki-links"))

        # I-S5: ≥2 outbound links (except maps and isolated)
        if not iso and fd["stem"] not in EXEMPT_FROM_OUTBOUND and len(fd["outlinks"]) < 2:
            violations.append((rel, "I-S5", f"only {len(fd['outlinks'])} outbound wiki-links (need ≥2)"))

        # I-S2: no dangling links (skip known external refs)
        for link in fd["outlinks"]:
            if link.lower() not in file_data and link.lower() not in EXTERNAL_REFS:
                violations.append((rel, "I-S2", f"dangling link [[{link}]] — target not found"))

        # I-S8: no backslash-pipe links (Obsidian plugin format breaks JS parser)
        for bp in fd["backslash_pipe_links"]:
            violations.append((rel, "I-S8", f"backslash-pipe link [[{bp[:60]}]] — run normalize-wikilinks.py"))

        if args.verbose and not any(v[0] == rel for v in violations):
            print(f"  OK  {rel}")

    # Output
    for rel, rule, msg in sorted(violations):
        print(f"  [{rule}]  {rel}  —  {msg}")

    total = len(file_data)
    n_viol = len(violations)
    n_orphan = sum(1 for fd in file_data.values() if fd["inlinks"] == 0 and not fd["is_isolated"])
    n_iso = sum(1 for fd in file_data.values() if fd["is_isolated"])

    # Smoke test
    smoke_edges, smoke_msg = (-1, "SKIP") if args.no_smoke else run_smoke_test()
    smoke_fail = smoke_edges >= 0 and smoke_edges < SMOKE_MIN_EDGES

    print(f"\n{'─'*50}")
    print(f"check-graph")
    print(f"  Scanned  : {total}")
    print(f"  Isolated : {n_iso}")
    print(f"  Orphans  : {n_orphan}")
    print(f"  Violations: {n_viol}")
    print(f"  Smoke    : {smoke_msg}")
    print()

    return 1 if (n_viol > 0 or smoke_fail) else 0


if __name__ == "__main__":
    sys.exit(main())
