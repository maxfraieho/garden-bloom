#!/usr/bin/env python3
"""
check-graph.py — Knowledge graph integrity check for docs/

Enforces:
  - I-S1: every doc has "## Семантичні зв'язки" (or isolated:intentional)
  - I-S3/I-S6: every doc has ≥1 inbound wiki-link (or isolated:intentional)
  - I-S5: every doc has ≥2 outbound wiki-links (or isolated:intentional)
  - I-S2: no dangling wiki-links (links to non-existent files)

Usage:
  python3 scripts/check-graph.py [--verbose] [--ci]

Exit codes:
  0 — clean graph
  1 — violations found
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

DOCS_DIR = Path(__file__).resolve().parent.parent / "docs"

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
    }
    return meta


def main() -> int:
    parser = argparse.ArgumentParser(description="Knowledge graph integrity check for docs/")
    parser.add_argument("-v", "--verbose", action="store_true", help="Show passing checks too")
    parser.add_argument("--ci", action="store_true", help="CI mode: no color, structured output")
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

        if args.verbose and not any(v[0] == rel for v in violations):
            print(f"  OK  {rel}")

    # Output
    for rel, rule, msg in sorted(violations):
        print(f"  [{rule}]  {rel}  —  {msg}")

    total = len(file_data)
    n_viol = len(violations)
    n_orphan = sum(1 for fd in file_data.values() if fd["inlinks"] == 0 and not fd["is_isolated"])
    n_iso = sum(1 for fd in file_data.values() if fd["is_isolated"])

    print(f"\n{'─'*50}")
    print(f"check-graph")
    print(f"  Scanned  : {total}")
    print(f"  Isolated : {n_iso}")
    print(f"  Orphans  : {n_orphan}")
    print(f"  Violations: {n_viol}")
    print()

    return 1 if n_viol > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
