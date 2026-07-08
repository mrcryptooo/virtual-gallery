# 05 — Development Roadmap

**Status: FROZEN (v3, 2026-07-08).** Phases end at explicit **exit gates**; later phases do not start on hope. Estimates assume one developer — sequencing, not promises. Adopting Photo Sphere Viewer (ADR-002) shifts the risk profile: viewer integration gets shorter; the transition system is now the highest-risk engineering and gets its own phase focus.

## Phase 0 — Foundation & pipeline proof (≈ 1 week)

- Workspace scaffold (`packages/engine`, `apps/portfolio`) per docs 03/06; ESLint (boundary rules), Prettier, Vitest, Playwright; CI skeleton.
- Design tokens + base primitives (Button, Panel, VisuallyHidden).
- Manifest schemas (zod) for the full hierarchy + `validate-packages.mjs`; a hand-built fixture package (2 rooms, 3 panoramas).
- **`build-package.mjs` end-to-end on one real 8K and one real 16K Lumion panorama** — equirect → cube faces → tile pyramid in the cubemap-tiles-adapter layout → preview → posters, with budget + banding gates. Needs real renders from the artist — request now.
- Discovery plugin: scan `public/projects/` → `projects-index.json` (ADR-013), with dev watch.

**Exit gate:** CI green; a real 16K render tiles correctly (seams/poles visually verified in a raw PSV test page); dropping the fixture package into `public/projects/` makes it appear in the generated index with no code change.

## Phase 1 — Engine core on PSV (≈ 1.5-2 weeks)

- ViewerCore: PSV + cubemap-tiles-adapter integration; default PSV UI fully disabled; motion tuning to doc 10 tokens (damping, inertia, limits); device profiles (DPR caps, level caps, `Save-Data`).
- Preview-first blur-up; loading choreography per doc 11 (SceneLoader).
- Engine facade (`createPanoramaEngine`) with typed commands/events; `useEngine()` binding; dev stats HUD (fps, resolution level, memory estimate).
- SceneManager: manifest model + hierarchy indexes; single-panorama boot via Project Loader; deep-link boot.
- **Decode-hitch measurement on mid-tier hardware** (ADR-006): scripted fast pans while streaming; decide whether the worker-decode adapter subclass is needed.

**Exit gate:** one 16K panorama on a mid-tier phone: first view < 2.5 s on throttled 4G, 60 fps pan while streaming (or worker-decode mitigation scheduled into Phase 3 with measurements attached); engine unit harness green; doc 08 §2 idle-rendering check passes.

## Phase 2 — The walkthrough: transitions, hotspots, tour (≈ 2-3 weeks, highest risk)

The product moment — this phase makes it Street View.

- Hotspot System: projection events from the engine; DOM `HotspotLayer` in the app; nav + info types; `pick-hotspots.mjs` yaw/pitch picker.
- Tour state machine wired: panorama switching, neighbor-preview prefetch (cross-floor/building links included), arrival views.
- **TransitionDirector: the signature move-toward-hotspot + blend (F4).** Build Tier A (PSV transition + our choreography) first; measure against the doc 10 §4 spec on real content; **if it reads as a fade rather than movement, build Tier B (dual-viewer compositing) — budgeted here, not discovered later.** Reduced-motion crossfade variant. Interruption safety.
- Deep links with view direction; URL sync.
- Multi-scene fixture project exercising the full hierarchy (2 buildings, 3 floors, cross-floor links).

**Exit gate:** navigating a 5+ panorama tour on a mid-tier phone: every transition starts ≤ 100 ms, sustains ≥ 45 fps, lands on authored arrival views, and **reads as movement through space in owner review** (the phase is not done on technical completion alone); E2E golden path passes.

## Phase 3 — Portfolio UI, wayfinding & accessibility parity (≈ 2 weeks)

- Portfolio home (from discovery index), project cards/pages, about/contact — full premium treatment per doc 11.
- Tour chrome: wayfinding breadcrumb (Building · Floor · Room, elided when singular), auto-hide behavior, fullscreen, share sheet, onboarding hints.
- **Space Index (F5):** hierarchical semantic-HTML parity surface; WebGL-less fallback route; per-level navigation for large projects.
- Keyboard support complete (doc 09 §3); reduced-motion behaviors throughout; settings panel.
- axe suite + screen-reader pass; loading experiences at all levels.

**Exit gate:** doc 09 checklist passes (screen-reader walkthrough of Space Index = 100% content parity; keyboard-only tour navigation; hierarchy jump ≤ 3 actions); Lighthouse a11y = 100 on all routes.

## Phase 4 — Real content, polish & performance hardening (≈ 2 weeks)

- Full real portfolio content; **the artist publishes one project unassisted using the runbook (doc 07 §7)** — friction found here is fixed here.
- Interaction polish pass to Awwwards standard: micro-easing, chrome choreography, cursor states, empty/error states; design-system audit of every surface.
- Performance hardening on real content: all doc 08 budgets in CI; low-tier profile verified on real hardware; worker-decode mitigation if Phase 1 measurement demanded it.
- SEO/social: prerendered meta + OG per project/panorama from manifests; sitemap.

**Exit gate:** all doc 08 budgets green in CI on real content; Lighthouse (mobile) ≥ 90 performance on `/`, a project page, and a tour entry; artist signs off every panorama (banding/seams) and the transition feel.

## Phase 5 — Launch (≈ 1 week)

- Production hosting (Cloudflare Pages), domain, cache policy per ADR-012, designed 404/offline pages.
- Cross-browser/device final matrix; WebGL-context-loss recovery verified.
- Docs updated to as-built (clarifications only — the architecture is frozen); tag `v1.0.0`.

**Exit gate:** launch checklist signed; deep links unfurl correctly; quiet first 48 h.

## Post-v1 candidates (each needs a mini-PRD; engine-first items marked ⚙)

1. **v1.1** Gyroscope look (F13) + guided autoplay (F14).
2. **v1.2** Floorplan minimap (F15); ambient audio (F16).
3. **v1.3** ⚙ Visual tour editor writing project packages (ADR-010 contract).
4. **v1.4** ⚙ Engine published as a versioned npm package + API docs site.
5. **v2.x** ⚙ Client-review mode; depth-assisted Tier B transitions from Lumion depth exports; WebXR; video panoramas.

## Standing risks

| Risk | Mitigation |
|------|-----------|
| **Transition quality misses "movement through space"** (make-or-break) | Two-tier strategy decided up front (ADR-002/doc 02 §2.3); Tier B budgeted inside Phase 2; owner review is part of the exit gate. |
| PSV constraints surface late (API limits, adapter behavior) | Phase 1 is deliberately a full integration spike on real 16K content; PSV containment (ADR-002) keeps any workaround local to ViewerCore. |
| Main-thread decode hitches on mid-tier mobiles | Measured explicitly in Phase 1; committed mitigation path (worker-decode adapter subclass, ADR-006). |
| 16K pipeline artifacts (seams, poles, banding) | Phase 0 proves the pipeline on real renders before anything depends on it; banding gate in the pipeline. |
| iOS Safari memory limits | Level caps per profile; real-device checks every phase; low-tier profile from day one. |
| Scope creep toward realtime 3D or platform features | Frozen docs; doc 01 hard exclusions; new ADR + owner approval required to even discuss. |
