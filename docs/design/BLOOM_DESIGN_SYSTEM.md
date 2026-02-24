# BLOOM Design System

> Visual identity and design guidelines for Garden Bloom platform

---

## 1. Кольори

### Primary Palette
| Token | Value | Usage |
|-------|-------|-------|
| `--garden-forest` | `hsl(174, 62%, 36%)` | Primary actions, links, active states |
| `--garden-teal` | `hsl(183, 55%, 55%)` | Secondary highlights, hover states |
| Accent | `hsl(38, 90%, 55%)` | Warnings, proposals, attention |

### Dark Mode
| Token | Value | Usage |
|-------|-------|-------|
| Background | `hsl(220, 15%, 12%)` | Page background — near-black charcoal |
| Surface | `hsl(220, 12%, 16%)` | Cards, panels, elevated surfaces |
| Primary | `hsl(190, 55%, 50%)` | Teal for primary actions |
| Text | `hsl(220, 20%, 88%)` | Primary text — light gray |
| Muted text | `hsl(220, 12%, 55%)` | Secondary text, labels |

### Light Mode
| Token | Value | Usage |
|-------|-------|-------|
| Background | `hsl(0, 0%, 100%)` | Clean white |
| Primary | `hsl(174, 62%, 36%)` | Deep teal / emerald |
| Text | `hsl(180, 6%, 16%)` | Near-black text |

### BLOOM-specific Colors
| Name | Value | Usage |
|------|-------|-------|
| Bloom Glow | `hsl(170, 60%, 45%)` | Logo glow, active node indicators |
| Graph Gray | `hsl(220, 10%, 40%)` | Graph edges, secondary structure |
| Node Green | `hsl(160, 50%, 50%)` | Active execution nodes |

---

## 2. Typography

### Font Stack
- **Headlines:** `Inter` (system sans-serif fallback) — clean, technical
- **Body text:** `Lora` (serif) — readable, knowledge-focused
- **Code/Technical:** `monospace` — system default

### Scale
| Element | Size | Weight | Font |
|---------|------|--------|------|
| H1 | 2.25rem | 600 | Sans |
| H2 | 1.5rem | 600 | Sans |
| H3 | 1.25rem | 600 | Sans |
| Body | 1rem | 400 | Serif |
| Small / Labels | 0.875rem | 400 | Sans |
| Caption | 0.75rem | 400 | Sans |

---

## 3. Logo Usage

### Files
- `/public/brand/bloom-logo.svg` — Full wordmark with symbol
- `/public/brand/bloom-symbol.svg` — Symbol only (for compact contexts)
- `/public/brand/bloom-favicon.svg` — Favicon variant

### Symbol Concept
The BLOOM symbol represents a **graph node bloom** — a central execution node with radiating branches, enclosed in an orchestration boundary (dashed circle). It is NOT a flower; it is an abstraction of logic expansion.

### Color Adaptation
- **Light mode:** Use `currentColor` (inherits dark text)
- **Dark mode:** Use `currentColor` (inherits light text)
- **Favicon:** Uses fixed `#2dd4a8` (BLOOM teal)

---

## 4. Components

### Auth Gate
The access gate is the entry point to the execution environment. It should convey:
- Security and exclusivity
- System-level aesthetic
- Atmospheric depth through subtle backgrounds

### Cards
- Subtle border, no heavy shadows
- Use `card` / `card-foreground` tokens
- Rounded corners: `var(--radius)`

### Buttons
- Primary: filled with `--primary`, text `--primary-foreground`
- Ghost: transparent, hover reveals `--accent` background
- Destructive: `--destructive` fill

---

## 5. Motion

- Fade-in: 0.3-0.5s ease-out for page elements
- Subtle glow animations for active states
- No excessive motion — precision over decoration

---

## 6. Domains (Suggestions)

### BLOOM-focused
1. bloom-runtime.com
2. bloom-engine.io
3. bloom-logic.dev
4. bloom-forge.io
5. bloom-core.systems
6. bloom-fabric.dev
7. bloom-system.io
8. bloomexec.com
9. bloom-orchestrator.com
10. bloom-behavioral.dev

### Garden-focused
11. gardenbloom.ai
12. gardenbloom.systems
13. gardenbloom.dev
14. garden-bloom.io
15. bloomgarden.systems

### Combined / Creative
16. bloomruntime.dev
17. thebloomengine.com
18. bloomlogic.systems
19. bloom-bespoke.dev
20. orderbloom.io
