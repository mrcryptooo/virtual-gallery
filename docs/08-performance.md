# 08 — Performance Requirements

**Status: FROZEN (v3, 2026-07-08).** Performance *is* the premium feel: a hitch during a pan or a stalled transition reads as cheap — fatal for a portfolio whose job is to signal quality, and disqualifying for a reusable engine. Budgets are **merge gates**; raising one requires an owner-approved amendment.

## 1. Reference hardware

| Tier | Reference device | Expectation |
|------|------------------|-------------|
| High | Desktop, modern GPU, DPR ≤ 2 | 60 fps everywhere, deepest tile level |
| Mid (primary target) | iPhone 12 / Pixel 6 class | 60 fps pan, ≥ 45 fps transitions, deepest level |
| Low | iPhone SE 2020 / Mali-G52 class | ≥ 30 fps, max level capped one step down (auto profile) |
| No WebGL2 | anything else | Space Index with posters — fast, complete |

## 2. Runtime budgets

| Metric | Budget | Enforced by |
|--------|--------|-------------|
| Pan/zoom frame rate | 60 fps mid-tier (no frame > 20 ms while streaming) | Playwright perf spec: scripted pan on fixture package, frame-time trace |
| Transition frame rate | ≥ 45 fps mid-tier, no frame > 33 ms | same, scripted transition (both tiers if Tier B is built) |
| Transition start latency (hotspot activation → first transition frame) | ≤ 100 ms — previews architecturally guaranteed resident | E2E assertion |
| GPU texture memory (resident tiles + previews) | ≤ 256 MB mid-tier / ≤ 128 MB low profile | ViewerCore accounting surfaced in dev HUD + perf spec assertion |
| Idle rendering | 0 frames when view is still and nothing is streaming | dev HUD counter, asserted in perf spec |
| JS heap after tour load | ≤ 120 MB | Playwright measurement |
| Pan input response | next frame (damping is intent, lag is a bug) | manual gate, Phases 1/4 |
| Decode hitches during fast pan while streaming | no main-thread stall > 20 ms attributable to decode | Phase 1 measurement (ADR-006); worker-decode mitigation if violated |

## 3. Load & payload budgets

| Asset / chunk | Budget |
|---------------|--------|
| Shell chunk (portfolio interactive; no PSV/three, gzip) | ≤ 180 KB |
| Engine chunk (engine + PSV + three, gzip, lazy) | ≤ 330 KB |
| Panorama preview cube (6 faces total) | ≤ 300 KB |
| Individual tile (512 px) | ≤ 90 KB typical, ≤ 140 KB max (deepest level) |
| Poster | ≤ 350 KB |
| Full pyramid per 16K panorama (all levels, one format) | ≤ 30 MB (streamed by visibility — never fully fetched in normal viewing) |
| Fonts (all subsets, woff2) | ≤ 120 KB |
| `project.json` (large project: 2+ buildings, 100+ panoramas) | ≤ 400 KB raw / ≤ 60 KB gzip |
| `projects-index.json` | ≤ 20 KB |

The engine chunk budget is sized for PSV pulling the full three build (ADR-002); it is a ceiling, not a target — Phase 1 records the actual figure.

**Experience targets (mobile, throttled 4G):**

- Portfolio home: LCP < 2.0 s (poster is the LCP element), INP < 200 ms, CLS < 0.1; Lighthouse mobile ≥ 90.
- **Tour entry → first navigable view: < 2.5 s** (preview visible and pannable; sharpening continues behind).
- Blur-to-sharp for the initial gaze direction, mid-tier: < 4 s.
- Space Index route: no engine chunk, no tiles — instant by construction.

## 4. Mandatory techniques (architecture, not optional ideas)

- **Multi-res visible-tile streaming** (ADR-004 via PSV's cubemap-tiles-adapter): never fetch pixels the visitor can't see; level from FOV × viewport × DPR (capped 2; low tier 1.5).
- **Preview-always-resident invariant:** every link-adjacent panorama's 6×256 preview prefetches on `viewing` and is never evicted while adjacent — this is what makes ≤ 100 ms transitions possible.
- **Demand rendering:** zero frames when idle (verified — PSV renders on demand; our layer must never introduce a rAF loop that defeats it).
- **Chunk split:** Space-Index-only and no-WebGL visitors never download the engine chunk; portfolio pages load posters only, never tiles.
- **Content-addressed tile URLs** (`tiles/<hash8>/…`, ADR-012): immutable 1-year caching for everything under `public/projects/`; manifests and the discovery index no-cache.
- **`Save-Data` / low-tier profile:** max level capped one step down; prefetch reduced to previews only; DPR cap 1.5.
- **Decode discipline** (ADR-006): measured in Phase 1; worker-decode adapter subclass is the committed mitigation if the §2 hitch budget fails.

## 5. Enforcement machinery

- `scripts/perf-budget.mjs` in CI: gzip chunk sizes + per-asset pipeline outputs vs. §3.
- Lighthouse CI (mobile emulation) on `/`, a project page, and a tour route per PR.
- Playwright perf spec on the fixture package: scripted pan + transition with frame-time traces; regression threshold ±10%.
- Dev HUD (dev builds): fps, frame time, current level, memory estimate, idle-render counter — violations visible the moment they're introduced.
- Phases 1 and 4 include manual runs on real low-tier hardware (doc 05); no launch without them.
