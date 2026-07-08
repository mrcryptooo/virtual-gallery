# 10 — Animation Guidelines

**Status: FROZEN (v3, 2026-07-08).** Motion is half of this product's perceived quality. The target feel: **calm, weighted, cinematic** — Google Street View's spatial logic with Apple-level restraint and finish. The imagery is still; every moving thing around it must feel engineered, never busy. When in doubt, animate less but tune harder.

## 1. Principles

1. **Motion explains space.** The transition exists to say "you stepped forward"; the damping exists to give the view mass. Anything that doesn't aid orientation or acknowledge input is decoration and is cut.
2. **Nothing moves uninvited.** No idle drift, no auto-rotation, no ambient parallax. A still viewer is perfectly still (also the demand-rendering invariant, doc 08).
3. **Interruptible always.** Any motion — including a transition — yields to new input instantly. Input is never locked.
4. **One thing at a time.** Chrome choreography never competes with a transition; UI waits for the scene to settle (≤ 80 ms overlap).
5. **Tuned on real content.** Motion sign-off happens inside real panoramas on real devices (Phase 2/4 gates), not in isolation.

## 2. Motion tokens (single source; mirrored into `tokens.css` and engine constants)

| Token | Value | Use |
|-------|-------|-----|
| `--motion-instant` | 100 ms | hover/press feedback, focus rings |
| `--motion-quick` | 200 ms | tooltips, chrome fade, small elements |
| `--motion-standard` | 300 ms | panels, overlays, Space Index open |
| `--motion-scene` | 900 ms | scene transition (move + blend) |
| `--motion-slow` | 1400 ms | first-entry reveal, loader exit |
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | default DOM easing |
| `--ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | elements leaving |
| View damping | critically damped, response ≈ 120 ms | pan/zoom follow and settle |
| Inertia decay | half-life ≈ 325 ms, clamped max fling velocity | drag release coasting |

No other durations or easings may be used; under the freeze, amendments require owner approval (README rule 3). PSV's default motion parameters are overridden wherever they differ — the tokens win (ADR-002: configuration as product).

## 3. Viewer motion rules (hard constraints — vestibular safety)

- **No camera roll, ever.** Yaw and pitch only; the horizon stays level.
- Pan follows input through critical damping — no overshoot, no rubber-banding. Post-release inertia decays smoothly and is fully clamped; a gentle flick must never spin the view.
- Zoom (FOV) is damped identically; FOV limits per device class; zoom changes only from explicit input or the transition move.
- Pitch clamps shy of the poles (±85°) with a soft approach, never a hard stop.
- Keyboard look uses the same damping as pointer look — one motion character everywhere, whatever input PSV receives.

## 4. The scene transition (the signature interaction — F4)

**Owner mandate: transitions must feel like Google Street View — the camera moves toward the hotspot before blending into the destination. Simple fades are not acceptable** (sole exception: the reduced-motion variant, §4-end).

**Normal ("step forward"), over `--motion-scene`:**

1. The view rotates toward the activated hotspot's direction while FOV narrows ~12° — the forward-motion cue, running on the live panorama.
2. The destination blends in — preview first (architecturally guaranteed resident, ≤ 100 ms start), sharpening live — aligned to its authored arrival direction, while the zoom continues through the blend so the motion never pauses.
3. FOV releases to the arrival value over the final 30%.

One continuous curve; no phase may read as a separate step, and the composite must read as *movement through space*, not a fade with garnish.

Rules:

- **Starts ≤ 100 ms** after activation.
- **Interruptible:** input during a transition completes the swap immediately (fast-out of the remainder) and returns control. Never ignore input, never queue it silently.
- Angular velocity capped: a hotspot far from the current gaze rotates longer, never faster.
- No motion blur, no exposure flash, no roll, no FOV change beyond the specified narrow.
- Arrival views are authored per link so the visitor lands facing something composed.

**Implementation strategy (doc 02 §2.3, decided by Phase 2 measurement):** Tier A choreographs PSV's animate + `setPanorama` transition; Tier B composites a pre-warmed second viewer with synchronized zoom during the blend. **The spec above is the acceptance bar for both — if Tier A cannot meet it, Tier B is built (budgeted in Phase 2), not the spec relaxed.**

**Reduced motion (`prefers-reduced-motion` or in-app setting):** rotation and zoom removed entirely — an equal-duration **pure crossfade** at the current gaze direction, arriving at the authored arrival direction via cut. Inertia disabled globally (doc 09 §4).

## 5. UI motion patterns

- **Tour chrome:** fades out after 3 s idle (`--motion-quick`); any input or keyboard focus restores it instantly (0 ms in — doc 09 §3). Breadcrumb updates (floor/building change) crossfade text at `--motion-quick`, never slide.
- **Panels/overlays (incl. Space Index):** `--motion-standard` enter, 12 px translate + fade; `--motion-quick` exit with `--ease-exit`; scrim in sync.
- **Hotspots:** appear with arrival (staggered ≤ 40 ms, opacity only); hover/focus brightens the backing at `--motion-instant`; no pulsing, no bobbing — presence by design, not agitation.
- **Loaders:** progress only moves forward with real progress; blur-up sharpening *is* the in-viewer loading animation — no spinner over a working panorama.
- **First entry:** one `--motion-slow` reveal (loader fade + slight FOV settle from +6°) on a project's first panorama — the one scripted flourish; skipped under reduced motion.
- **Hover/press:** ≤ 1.02 scale; opacity/color within tokens.

## 6. Implementation mapping (ADR-007)

- Viewer motion lives inside the engine, expressed through ViewerCore's normalized animation layer over PSV: critically-damped, delta-time based, tokens imported from the shared definition. No tween library in the engine.
- DOM chrome uses Motion (Framer Motion) variants fed by the same tokens from `tokens.css`.
- Any animation running > 5 s or looping requires an owner-approved design-system amendment and a pause affordance (WCAG 2.2.2). Guided autoplay (v1.x) ships with visible pause and stops on any input.
