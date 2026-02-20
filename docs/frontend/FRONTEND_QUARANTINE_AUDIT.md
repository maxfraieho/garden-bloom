# Frontend Quarantine Audit

> Generated: 2026-02-20 | Auditor: Lovable (Frontend Engineer)
> Scope: Files moved to `_quarantine/` by Claude CLI — check for misplaced frontend assets

---

## Referenced by frontend but quarantined (CRITICAL)

**None found.** ✅

Frontend (`src/`, `public/`) does NOT import or reference any path inside `_quarantine/`.

Key verified references:
- `src/lib/drakon/adapter.ts` → `/libs/drakonwidget.js` → lives in `public/libs/` ✅
- `src/lib/drakon/pseudocode.ts` → `/libs/drakongen.js` → lives in `public/libs/` ✅
- `src/index.css` mentions `new_desijn/` in a **comment only** (design was already adopted) ✅
- `vendor/drakonwidget/` remains in project root ✅

---

## Must be restored to frontend

**None.** No React components, frontend hooks, utilities, styles, or actively-used images were found in the audited quarantine directories.

---

## Should move to docs/

| Path | Reason |
|------|--------|
| `_quarantine/research/blog-research/` | Research/documentation content — fits `docs/research/` |
| `_quarantine/specs/` | Architecture specifications — fits `docs/specs/` or `docs/architecture/` |
| `_quarantine/scratchpad/README.md` | Contains operational notes that may have documentation value |

---

## Safe in quarantine

| Path | Reason |
|------|--------|
| `_quarantine/archive/starlight-gh-aw/` | Astro/Starlight project (NOT React). Separate SSG framework, own `tsconfig.json`, own `package.json`. Not part of Vite/React build. |
| `_quarantine/new_desijn/` | Design prototype already adopted into `src/index.css`. Only a comment references it. No runtime dependency. |
| `_quarantine/drakongen/` | Standalone DRAKON codegen tool (JS library source + examples). Frontend uses the **compiled** version at `public/libs/drakongen.js`, not this source tree. |
| `_quarantine/examples/` | Example files for drakongen/workflows. Not imported by frontend. |
| `_quarantine/scripts/` | Build/migration scripts. Not part of frontend runtime. |
| `_quarantine/cmd/` | Go CLI toolchain. |
| `_quarantine/pkg/` | Go packages. |
| `_quarantine/internal/` | Go internal tools. |
| `_quarantine/cloud-cli/` | CLI agent tool. Not frontend. |
| `_quarantine/slides/` | Presentation materials. |
| `_quarantine/socials/` | Social media content. |
| `_quarantine/tmp/` | Temporary files. |
| `_quarantine/add_editor/` | Editor prototype. Not integrated into current frontend. |
| `_quarantine/archive/legacy-en/` | Legacy English docs, superseded. |
| `_quarantine/archive/deprecated/` | Explicitly deprecated. |
| `_quarantine/archive/migration/` | Migration artifacts. |
| `_quarantine/archive/orchestration-migrations/` | Backend orchestration. |
| `_quarantine/archive/gh-aw/` | GitHub Agentic Workflows archive. |

---

## Summary

| Category | Count |
|----------|-------|
| 🔴 CRITICAL (referenced by frontend) | 0 |
| 🟡 Must restore to frontend | 0 |
| 🔵 Should move to docs | 3 |
| 🟢 Safe in quarantine | 17 |

**Conclusion:** The quarantine is clean. No frontend-critical files were misplaced. The frontend build (`npm run build`) should be unaffected by the quarantine operation.

---

## Notes

1. `vendor/drakonwidget/` was correctly kept outside quarantine — it contains source for the DRAKON widget used by the frontend.
2. `public/libs/` was correctly kept — it serves compiled JS libraries loaded at runtime.
3. `src/site/` and `public/site/` were correctly kept — canonical content snapshots per project constraints.
4. The `_quarantine/drakongen/` source tree could theoretically be needed if `public/libs/drakongen.js` needs rebuilding, but that's a dev toolchain concern, not a frontend runtime concern.
