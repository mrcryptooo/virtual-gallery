# 11 — Design System

**Status: FROZEN (v3, 2026-07-08).** This design system belongs to the **portfolio — the engine's first client**. The engine itself ships no UI (doc 02); another engine adopter may bring a different design system, but every visible element of *this* product conforms to this document.

The visual language of Virtual Gallery. Direction: **cinematic minimalism** — the interface of a premium portfolio whose content is full-bleed photorealistic imagery. The UI behaves like theater lighting: near-invisible while you look at the work, precise and confident when you need it. Grounded in the minimalism + motion-driven profile from the `ui-ux-pro-max` reference data, executed **dark-first** because chrome floats over imagery.

This document is the only source of visual tokens. New colors, type sizes, spacing values, radii, shadows, or motion values require amending this doc first (README governance rule 3).

## 1. Design tokens (`src/styles/tokens.css`)

### Color

Near-monochrome, dark-first. The renders supply all the color; UI color never competes with them.

| Token | Value | Role |
|-------|-------|------|
| `--color-bg` | `#0C0C0E` | Portfolio pages background (near-black, not pure — pure black deadens imagery) |
| `--color-surface` | `#161618` | Cards, panels, chrome backings |
| `--color-surface-raised` | `#1E1E21` | Dialogs, share sheet |
| `--color-ink` | `#F4F4F5` | Primary text (17.5:1 on bg ✓) |
| `--color-ink-soft` | `#A1A1AA` | Secondary text, metadata (7.6:1 ✓) |
| `--color-line` | `#2A2A2E` | Hairline borders, dividers |
| `--color-accent` | `#C8A560` | Warm brass — links, active states, progress, hotspot cores. Sparingly; never large areas. (7.9:1 on bg ✓) |
| `--color-focus-ring` | `#7DB4FF` | Keyboard focus only (≥3:1 on all surfaces ✓) |
| `--scrim` | `rgba(12, 12, 14, 0.55)` | Behind overlays over panoramas |
| `--scrim-edge` | gradient `rgba(12,12,14,0.6) → transparent`, 120 px | Top/bottom chrome backing over imagery — text over panoramas always sits on a scrim or surface token (doc 09 §5) |
| `--color-paper` / `--color-paper-ink` | `#FAFAF9` / `#111112` | Light contexts (case-study text pages, print/OG), used page-level only — no per-component theme switching |

### Typography

Pairing: **Playfair Display** (display serif — editorial, gallery-catalog voice for titles) + **Inter** (UI sans). Self-hosted woff2 subsets (ADR-011), ≤ 120 KB total (doc 08).

| Token | Font / size / line-height | Use |
|-------|--------------------------|-----|
| `--type-display` | Playfair Display 500, `clamp(2.75rem, 7vw, 5.5rem)` / 1.02, -0.01em | Home hero, project titles on entry |
| `--type-title` | Playfair Display 500, 2rem / 1.15 | Scene names, section titles |
| `--type-heading` | Inter 600, 1.125rem / 1.3, 0.01em | Panel headings, card titles |
| `--type-body` | Inter 400, 1rem / 1.6 | Descriptions, general UI |
| `--type-caption` | Inter 400, 0.875rem / 1.5 | Metadata (location, year, software) |
| `--type-label` | Inter 500, 0.75rem / 1.2, 0.08em, uppercase | Buttons, wayfinding, chrome labels |

Rules: body never below 1rem; Playfair never below 1.5rem; reading columns ≤ 65ch; numerals in metadata use `font-variant-numeric: tabular-nums`.

### Spacing, radius, elevation

- Spacing (4-px base): `--space-1…9` = 4, 8, 12, 16, 24, 32, 48, 64, 96 px. No off-scale values.
- Radii: `--radius-s: 4px` (inputs, chips), `--radius-m: 8px` (cards, panels), `--radius-full` (hotspot marks, icon buttons). Nothing else.
- Elevation: hairline borders (`--color-line`) first; shadows only for true overlays: `--shadow-overlay: 0 12px 48px rgba(0,0,0,0.5)`.
- Layout: portfolio content max-width 1280 px; reading columns 680 px; gutters `--space-5` mobile / `--space-7` desktop. The viewer itself is always full-bleed.

### Motion

Owned by [10-animation-guidelines.md](10-animation-guidelines.md) §2, mirrored into `tokens.css` and engine constants — one definition, no drift.

## 2. Components (v1 inventory — the complete sanctioned set)

| Component | Description & rules |
|-----------|--------------------|
| **Button** | `primary` (ink fill, bg text), `ghost` (hairline border), `quiet` (text, accent hover). Height 44 px; `--type-label`; `--radius-s`. |
| **IconButton** | 44×44 px; circular (`--radius-full`) on chrome; always `aria-label` + tooltip. |
| **NavHotspot** | The Street View marker: circular mark (accent core, soft `--scrim` backing disc ≥ 44 px hit area), direction-aware label on hover/focus ("Terrace →"). A real `<button>`; scales subtly with proximity to screen center; never pulses. |
| **InfoHotspot** | Small circular mark, `+` glyph, same backing/hit rules; opens InfoPanel. |
| **TourChrome** | Persistent minimal frame over the viewer: top scrim-edge with project title + Breadcrumb + panorama name, bottom-right cluster (Space Index, fullscreen, share, help). Auto-hides after 3 s idle; instant restore on input or keyboard focus (doc 09 §3). |
| **Breadcrumb** | Wayfinding: *Building · Floor · Room* in `--type-label`, singular levels elided (doc 01 §3.1); current location `aria-current`; text crossfades on change (doc 10 §5). A `nav` landmark. |
| **ProjectCard** | Portfolio entry: full-bleed poster, title on `--scrim-edge`, metadata line. Whole card is one link; hover: poster scale 1.02 + scrim deepen. |
| **SpaceIndexPanel** | The parity surface (doc 09): full-height sheet mirroring the hierarchy — buildings → floors → rooms as nested, collapsible semantic lists; panorama entries (thumb, name, description, connections; cross-floor links marked with a glyph); current panorama marked. Also a standalone route. Reaching any room takes ≤ 3 actions. |
| **InfoPanel** | Dialog on `--color-surface-raised`: title, body ≤ 65ch, optional image. Right sheet ≥ 1024 px; bottom sheet below. Focus-trapped (doc 09 §2). |
| **SceneLoader** | In-viewer state: poster/preview blur-up IS the loader; a 2-px accent progress line at the viewport top for tile streaming. No spinner over a working panorama. |
| **PageLoader** | Project entry: `--color-bg`, project title in `--type-display`, forward-only progress, "View space index" escape link. |
| **OnboardingHints** | First-tour overlay: device-aware gesture hints ("Drag to look around · Tap circles to move"), dismiss persists. |
| **ShareSheet** | Copies deep link with current view; OG preview shown. |
| **SettingsMenu** | Motion, gyro (v1.x), audio (v1.x), quality override. Toggle rows, 44 px. |
| **Toast** | Bottom-center, polite live region, 4 s, max 2 stacked. |
| **Scrim** | `--scrim` token; owns overlay click-to-close. |

Anything not in this table doesn't exist yet: adding a component means adding a row here (with states) in the same PR.

## 3. Interaction states (every interactive element defines all six)

`default → hover → active/pressed → focus-visible → disabled → loading`

- Hover: opacity/color shifts within tokens; scale ≤ 1.02 (doc 10 §5).
- Focus-visible: 2 px `--color-focus-ring` outline, 2 px offset, identical everywhere — over imagery it sits on the element's scrim backing so it reads against any panorama content.
- Disabled: 40% opacity + `cursor: not-allowed`; prefer explaining over disabling.
- Loading: buttons swap label for inline spinner, width preserved; imagery uses blur-up, never skeleton gray over panoramas (skeletons allowed in Space Index thumbs: `--color-surface` shimmer).

## 4. Imagery presentation rules

- Panoramas and posters are **never** tinted, gradient-mapped, or filtered by the UI; scrims exist for text legibility only and are confined to edges/overlays.
- Posters render full-bleed in cards with `object-fit: cover`; artwork aspect is preserved everywhere else.
- Blur-up: preview scales with a 12-px blur that resolves as tiles sharpen — the transition from blur to sharp is itself a designed moment (doc 10 §5).
- Empty/error imagery states use `--color-surface` with a centered `--type-label` line — designed, never broken-looking.

## 5. Voice & copy

- Confident, quiet, precise — a monograph, not a brochure: "Enter walkthrough", not "Start exploring now! 🚀". No exclamation points, no emoji in product copy.
- Panorama metadata order fixed: *Name — description. Connections.* Project metadata: *Location · Year · Client (optional)*. Wayfinding always reads Building · Floor · Room, elided per doc 01 §3.1.
- Hierarchy terms in visitor-facing copy are the manifest's own names ("Ground Floor", "Guest House") — the UI never invents labels like "Level 0".
- Instructional copy is device-aware and always includes the keyboard alternative ("Drag or use arrow keys to look around").
- Errors are plain-language, actionable, and always offer the Space Index as a path forward.
