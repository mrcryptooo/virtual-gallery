# 09 — Accessibility Requirements

**Status: FROZEN (v3, 2026-07-08).** Target: **WCAG 2.2 AA** across the product. An immersive panorama viewer cannot be made fully accessible by ARIA alone, so the strategy is **content parity through a peer experience** (the Space Index), plus making the viewer itself as accessible as the medium allows. These requirements bind the engine's API design too: a client must be *able* to build an accessible experience from what the engine exposes.

## 1. The parity principle (governs everything)

> Everything that matters — seeing each environment, reading its information, understanding where it sits in the building, moving between panoramas, sharing, contacting the artist — must be fully available without the WebGL viewer.

Concretely, this is the **Space Index** (F5): a semantic-HTML rendering of a project's full hierarchy — **buildings → floors → rooms → panoramas** — generated from the same manifest as the viewer, so parity is structural, not maintained by discipline. Each panorama entry shows its poster still, name, description, and connections ("Leads to: Kitchen, Stair Hall (Floor 2)"). The Space Index is:

- reachable from tour chrome at all times, from the project page, and directly by route;
- presented as a first-class way to browse, never labeled or styled as a degraded fallback;
- hierarchical for large projects (jump to any room in ≤ 3 actions) with singular levels elided, exactly like the viewer's wayfinding (doc 01 §3.1);
- the automatic experience when WebGL2 is unavailable or the context is lost twice;
- fast — no engine chunk, no tiles, only posters (doc 08 §3).

Names, descriptions, and poster alt text are **required by the manifest schema — missing text fails package validation** (ADR-010). Deep links resolve in both modes: `/p/:project/pano/:id` focuses the panorama in the viewer or anchors its Space Index entry.

## 2. Semantic & screen-reader requirements

- Portfolio and Space Index: proper landmarks, one `h1` per page, hierarchy as nested navigable lists with heading levels following building → floor → room, panorama entries as `article`s.
- The canvas is `aria-hidden`; the viewer region carries a visually-hidden description of the current panorama and location, plus a pointer to the Space Index.
- A polite `aria-live` region announces context changes: arrival ("Now viewing: Living Room, Ground Floor — 3 paths available"), transition start, loading resolution, floor/building changes ("Now on Floor 2").
- **Hotspots are real DOM `<button>`s** (engine emits projection data; the client renders — doc 02 §2.4) with descriptive labels ("Go to Kitchen", "Go to Stair Hall, Floor 2 — changes floor"). Cross-floor/building links say so in their label.
- Info panels and overlays are proper dialogs: focus trapped, labelled, Escape closes, focus returns to the invoking control.
- The wayfinding breadcrumb (doc 01 F8) is a `nav` landmark, current location marked with `aria-current`.

## 3. Keyboard requirements (viewer included)

| Action | Keys |
|--------|------|
| Look around | Arrow keys (Shift for fine) |
| Zoom | `+` / `-` |
| Cycle hotspots in current panorama | Tab / Shift+Tab (focus visibly tracks; view auto-pans to bring the hotspot on screen) |
| Activate hotspot (navigate / open info) | Enter |
| Close panel / cancel | Escape |
| Space Index | `I` and a visible chrome button |
| Fullscreen | `F` |

- Everything achievable by pointer is achievable by keyboard; no pointer-lock ever.
- Tour chrome auto-hides on idle but **restores instantly on any keyboard focus** — never hidden from keyboard users.
- Visible focus indicators per design system on every interactive element; over imagery, focus rings sit on the hotspot's scrim backing so they read against any panorama content.
- No keyboard traps; the viewer region is enterable and escapable with Tab.

## 4. Motion, vestibular & photosensitivity safety

- `prefers-reduced-motion: reduce` (or the in-app setting, which overrides the OS signal in either direction):
  - scene transitions become **pure crossfades** — the move-toward-hotspot rotation and zoom are removed entirely. This is the sole sanctioned exception to F4's "no simple fades" rule, and it is non-negotiable (doc 10 §4);
  - no auto-panning: the view never moves except from direct user input (Tab's auto-pan becomes an instant reposition);
  - inertial coasting after release is disabled;
  - DOM animations reduce to opacity-only.
- Guided autoplay (v1.x) never starts automatically and is disabled under reduced motion.
- No flashing content anywhere, including loaders; nothing exceeds three flashes per second.
- FOV changes only from explicit zoom input or the (removable) transition move; no camera roll — ever (doc 10 §3).

## 5. Visual requirements

- Text contrast ≥ 4.5:1 (normal) / 3:1 (large); UI boundaries ≥ 3:1. Token pairs in doc 11 are pre-verified.
- **Text and controls over panorama imagery always sit on a scrim or surface token** — contrast never depends on what the render shows behind them. Hotspots carry a token-defined backing disc for the same reason.
- All UI functional at 200% zoom and 320 px width without horizontal scrolling (Space Index is the reference surface).
- Touch targets ≥ 44×44 px, including hotspots (the visual mark may be smaller; the hit area may not).
- No information by color alone (visited panoramas in the Space Index get a checkmark; cross-floor links get a glyph, not just a tint).

## 6. Testing & enforcement

- `jsx-a11y` at error level; vitest-axe on every DOM component suite; Playwright + axe scans on portfolio, project page, tour (chrome visible + panels open), and Space Index — all merge gates.
- Keyboard-only journey (enter tour → look → Tab to hotspot → Enter → arrive on another floor → breadcrumb check → Space Index → jump rooms) is an E2E spec, not a manual habit.
- Manual screen-reader pass (NVDA + VoiceOver/iOS) is part of the Phase 3 exit gate and the launch checklist (doc 05).
- Any new overlay/component is reviewed against this doc's checklist at PR time.
