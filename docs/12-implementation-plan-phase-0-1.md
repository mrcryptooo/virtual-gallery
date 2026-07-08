# 12 — Implementation Plan: Phase 0 → Phase 1

**Status: ACTIVE (2026-07-08).** This plan *implements* the frozen architecture (docs 01–11, v3); it introduces no architectural decisions. If executing a milestone surfaces a genuine conflict with the frozen docs, work stops and the conflict is escalated to the owner — it is never resolved silently in code.

## How this plan works

- **Milestones are small and self-contained.** Each is independently buildable (the repo builds and deploys green at its end), independently testable (its own verification, automated wherever possible), and depends only on *completed* earlier milestones — never on unfinished future systems. Where a later system would normally be needed, the milestone uses a **fixture or harness** defined inside the milestone itself.
- **Every milestone ends with a review checkpoint**: a short list of pass/fail criteria plus what the owner should look at. A milestone is *done* when its checkpoint passes — not when its code exists. Checkpoints marked **[Owner]** need the artist's eyes (visual/feel judgments); the rest are self-verifiable via CI and recorded evidence.
- **One milestone per PR** (or a short PR series); CI green at every merge; `main` stays deployable throughout.

### External input needed (requested now, blocks nothing until M0.6)

From the owner/artist: **one real 8K and one real 16K equirectangular Lumion export** (per doc 07 §5 conventions). Milestones before M0.6 use a synthetic panorama, so work starts immediately either way.

---

## Phase 0 — Foundation & pipeline proof

### M0.0 — Project Bootstrap *(added 2026-07-08 at owner request; absorbs M0.1 and most of M0.2)*

**Goal:** a production-grade repository foundation before any product code — tooling, hygiene, and CI only.
**Owner decisions recorded (2026-07-08 Q&A):** Vite + React per frozen ADR-003 (Next.js declined); frozen token-based design system (Tailwind + shadcn/ui declined); TanStack Query omitted; **pnpm** workspaces adopted as an owner-approved tooling clarification of ADR-003's "npm workspaces" (architecture unchanged). Per ADR-002 containment, three.js is not a direct dependency — it arrives via Photo Sphere Viewer.
**Scope:** git init; pnpm workspace (`packages/engine` stub export only + `apps/portfolio` minimal Vite/React/TS scaffold); `tsconfig.base.json` with doc 06 §1 flags; path aliases / absolute imports; ESLint flat config (typescript-eslint strict-type-checked, `react-hooks`, `jsx-a11y` at error, `eslint-plugin-boundaries` per doc 02 §8/doc 06 §5); Prettier (frozen config); EditorConfig; Husky + lint-staged + Commitlint (Conventional Commits, doc 06 §9); environment-variable structure (`.env.example`, `VITE_` convention); GitHub Actions CI (lint → typecheck → test → build); doc 03 folder structure stubbed; README, LICENSE, `.gitignore`; dependencies installed per frozen ADRs (engine: PSV core + cubemap-tiles-adapter, zod; app: react, react-router, zustand, motion).
**Explicitly out:** engine code, panorama code, UI implementation, application logic, design tokens (M0.3), Playwright (M0.2 residual).
**Verify:** clean install → lint → typecheck → test → build all green locally and in CI; boundary canaries (React in engine, PSV in components, deep engine import in app) each fail lint and are then removed; commit hooks fire (bad commit message rejected, staged files formatted).
**Review checkpoint:** **[Owner]** repository skeleton reviewed: layout matches doc 03, tooling matches doc 06, dependency set matches the ADRs exactly (nothing extra, nothing missing). Owner sign-off before M0.3 begins.

### M0.1 — Workspace skeleton — **ABSORBED into M0.0**

Retained for numbering stability; all scope delivered by M0.0.

### M0.2 — E2E runner & CI smoke (residual)

**Goal:** the last piece of the quality-gate story not covered by M0.0.
**Scope:** Playwright installed with one trivial smoke spec (app boots, heading visible) on chromium + webkit; CI gains the smoke stage.
**Explicitly out:** perf budgets and package validation (their subjects don't exist yet).
**Verify:** CI green including smoke on a PR.
**Review checkpoint:** CI pipeline reviewed end-to-end: lint → typecheck → unit tests → build → smoke, all required to merge.

### M0.3 — Design tokens & base primitives

**Goal:** the design system's foundation exists before any UI is built on it.
**Scope:** `styles/tokens.css` transcribing doc 11 §1 and the doc 10 §2 motion tokens verbatim; self-hosted subsetted fonts (Playfair Display, Inter) within the 120 KB budget; global styles (reset, focus-ring standard, reduced-motion media hooks); primitives: `Button` (3 variants), `IconButton`, `Panel`, `VisuallyHidden`, `Toast`, `Scrim` — each with all six interaction states (doc 11 §3); an internal `/[dev]/tokens` showcase route rendering every token and primitive state.
**Explicitly out:** all tour/portfolio components.
**Verify:** component tests + vitest-axe on every primitive; a token-lint check (script greps built CSS for hex values / px sizes / durations not present in `tokens.css`); font payload measured.
**Review checkpoint:** **[Owner]** showcase route reviewed against doc 11 (colors, type, spacing, states, focus rings on dark surfaces); axe clean; fonts ≤ 120 KB; token-lint passes.

### M0.4 — Manifest contract & fixture package

**Goal:** the content contract (ADR-010/014) is executable: schemas, validation, and a reference package.
**Scope:** zod schemas in `packages/engine/domain/manifest/` for the full hierarchy (`Project → Building → Floor → Room → Panorama`, hotspots, views, tiles metadata, semver `schemaVersion`); hierarchy indexes (panorama ⇄ building/floor/room lookups); `scripts/validate-packages.mjs` running every ADR-010 gate (schema, file existence, hotspot resolution, required text, link-graph connectivity, id uniqueness); a **hand-built fixture package** (2 buildings, 3 floors, 6 panoramas incl. one cross-floor link) with placeholder-colored tiles/previews/posters at correct sizes and paths — the permanent test asset for everything downstream.
**Explicitly out:** the real tile pipeline (fixture assets are hand/script-generated placeholders); runtime loading.
**Verify:** ~100% branch unit coverage on schema + indexes; validator catches 10+ seeded defect variants (missing alt text, dangling hotspot target, duplicate id, orphan panorama, missing tile file…); the intact fixture passes.
**Review checkpoint:** manifest shape reviewed against doc 01 §3.1 and doc 07 §2 one final time before anything is built on it (it is a frozen public contract); validator wired into CI.

### M0.5 — Tile pipeline I: reprojection & pyramid on synthetic imagery

**Goal:** the mathematically hard core of `build-package.mjs` — equirect → cube faces → quadtree tiles — proven deterministic and correct.
**Scope:** master validation (2:1, ≥ 8192×4096, sRGB); Lanczos3 equirect→cube reprojection with pole oversampling; per-face quadtree slicing (512-px tiles, level ladders per doc 07 §2) in the PSV cubemap-tiles-adapter layout; content-hash version segment in output paths; incremental `.asset-cache/`; a **synthetic test master** (generated labeled grid + gradients, 16384×8192) making seams, orientation, and pole errors visually and programmatically obvious.
**Explicitly out:** AVIF/WebP encoding ladder (PNG output is fine here), previews/posters, quality gates.
**Verify:** unit tests on reprojection math (known pixel correspondences); tile-edge continuity checked programmatically across all 12 cube edges on the synthetic master; re-running the pipeline unchanged reprocesses nothing (cache hit); output layout matches the adapter's URL template exactly.
**Review checkpoint:** synthetic-master face images inspected for seam/pole/orientation defects; determinism and cache behavior demonstrated in CI logs.

### M0.6 — Tile pipeline II: encoding, previews, posters, quality gates — on real renders

**Goal:** the pipeline is production-complete and proven on the artist's actual work. *(Needs the real 8K + 16K exports.)*
**Scope:** AVIF + WebP encoding with the per-level quality ladder (doc 07 §4, 4:4:4 at deepest level); 6×256 preview cubes; posters/thumbs/OG crops from authored views; the **banding gate** and **cross-face seam gate**; per-asset budget enforcement (doc 08 §3); `project.authoring.json` → published `project.json` stamping; `npm run package:build -- <slug>` end-to-end; regenerate the M0.4 fixture package through the real pipeline (replacing hand-built placeholders).
**Explicitly out:** any viewer — verification of visual quality uses a throwaway raw-PSV HTML test page (10 lines, discarded after; the real integration is M1.1).
**Verify:** budgets enforced (oversize tile fails); banding gate demonstrated on a deliberately over-compressed run; both real renders package within budget; incremental rebuild after touching one master reprocesses only that panorama.
**Review checkpoint:** **[Owner]** both real panoramas inspected in the raw test page at full zoom — seams, poles, banding, color fidelity vs. Lumion output. This checkpoint is the Phase 0 keystone: nothing downstream is trusted until the artist trusts the pixels.

### M0.7 — Project discovery (drop-in publishing)

**Goal:** F9/ADR-013 works end-to-end: copy a folder, get a project.
**Scope:** Vite plugin scanning `public/projects/*/project.json` at build (+ dev watch) → generated `projects-index.json` (slugs, titles, covers, versions); invalid packages excluded with a report; CI wiring of `validate-packages.mjs` over `public/projects/`; caching headers config per ADR-012 (index/manifests no-cache, content-hashed tiles immutable).
**Explicitly out:** any UI consuming the index (a raw JSON fetch assertion suffices).
**Verify:** E2E-style test: copy fixture package in → build → index contains it; delete → gone; corrupt its manifest → excluded from index with report, and CI validation fails the PR.
**Review checkpoint:** **Phase 0 exit gate (doc 05) reviewed as a whole:** clean-clone build; real 16K render tiles correctly; fixture package appears via pure folder-copy with zero source changes. Owner sign-off closes Phase 0.

---

## Phase 1 — Engine core on PSV

### M1.1 — ViewerCore spike: PSV renders our packages

**Goal:** de-risk the load-bearing integration (ADR-002) before building on it.
**Scope:** minimal `ViewerCore` in the engine: instantiate PSV + cubemap-tiles-adapter against a package's tile metadata; PSV's default UI (navbar, loader, markers) fully disabled; correct destroy/recreate lifecycle; a bare internal harness route in the app hosting it (temporary, dev-only).
**Explicitly out:** motion tuning, facade API, previews/blur-up, SceneManager.
**Verify:** fixture + both real panoramas render and pan in the harness; Playwright screenshot comparisons of deterministic views (seams, orientation, level sharpening); lifecycle test — create/destroy 10× leaves no listeners, observers, or GL contexts (heap/context assertions).
**Review checkpoint:** **[Owner]** real content viewed in the harness on desktop + a real phone; any PSV surprise (API gap, adapter behavior) documented now, while everything is still cheap to adjust *within* the frozen architecture's containment seam.

### M1.2 — Engine facade & typed API

**Goal:** the engine's public contract exists and is the only way in.
**Scope:** `createPanoramaEngine(container, options)` facade; typed command surface (`loadProject`, `goToPanorama`, `lookAt`, `destroy` — `transitionTo` stubbed to throw "Phase 2" for now); typed event emitter (`viewchange`, `panoramachanged`, `tileprogress`, `error`); `index.ts` public surface with JSDoc on every export; internal wiring facade → ViewerCore; deep-import lint block verified.
**Explicitly out:** transitions, hotspots, preloading (events for them are *declared* in the API where already specified by doc 02, but fire only when their milestones land).
**Verify:** unit harness drives the full command surface against the fixture package in a real browser (no PSV mocks — doc 06 §8); event payloads type-checked and asserted; `destroy()` leak test repeated through the facade.
**Review checkpoint:** API review against doc 02 §2 — names, payloads, and error behavior are a frozen contract's first implementation; a written API sketch (markdown, in the PR) is approved before merge.

### M1.3 — SceneManager: hierarchy, tour machine, preload policy (pure domain)

**Goal:** the content brain, complete and headless. *(Independent of M1.1/M1.2 internals — depends only on M0.4 schemas; can run in parallel with M1.2.)*
**Scope:** in `packages/engine/domain/`: tour state machine (`idle → loading → viewing → transitioning → viewing`, overlay states orthogonal) as a typed transition table; hierarchy model finalization (wayfinding derivation: panorama → Building · Floor · Room with singular-level elision); preload policy (link-adjacent preview prefetch, cross-floor/building included, `Save-Data` aware) expressed as pure "what to fetch next" decisions.
**Explicitly out:** any I/O, any PSV — the policy *decides*; ViewerCore *executes* (M1.5).
**Verify:** ~100% branch coverage; property-style tests on the machine (no illegal transition reachable); elision rules tested for 1-building/1-floor, multi-building, and cross-floor-link fixtures.
**Review checkpoint:** state diagram + wayfinding examples in the PR reviewed against doc 01 §3.1 and doc 02 §2.2; no code beyond `domain/` touched.

### M1.4 — Motion tuning & device profiles

**Goal:** the viewer *feels* like doc 10 — the first "premium" judgment call.
**Scope:** ViewerCore motion normalization: critically-damped pan/zoom (response ≈ 120 ms), inertia (half-life ≈ 325 ms, clamped fling), pitch soft-clamp ±85°, FOV limits, keyboard look with identical damping; PSV defaults overridden by doc 10 §2 token constants; device profiles (DPR caps 2/1.5, level caps, low-tier detection, `Save-Data`); reduced-motion behaviors at the viewer level (inertia off, no auto-motion).
**Explicitly out:** transitions (Phase 2), gyro (v1.x).
**Verify:** kinematics unit tests on the damping helpers; Playwright scripted-pan traces (no overshoot, clamped fling velocity asserted from recorded view samples); profile selection tests per simulated device class.
**Review checkpoint:** **[Owner]** feel review on real content, desktop + phone: "does panning feel weighted, calm, and instant?" — tuning iterations happen inside this milestone until it does. Doc 10 §3 hard constraints (no roll, pole behavior) verified.

### M1.5 — Streaming discipline: preview blur-up & loading choreography

**Goal:** doc 08's loading experience: something designed is always on screen.
**Scope:** preview-cube-first loading with blur-up resolve into sharp tiles; `tileprogress` events wired to real adapter activity; preload-policy execution (M1.3 decisions → actual preview prefetches, resident-preview guarantee); SceneLoader choreography hooks (engine side — events only); network-failure behavior (retry/backoff, blur-hold, `error` events).
**Explicitly out:** the transition consuming those resident previews (Phase 2); app-side loader UI polish (Phase 3).
**Verify:** throttled-4G Playwright run on the fixture: first navigable view < 2.5 s asserted; preview-resident invariant asserted for all link-adjacent panoramas after `viewing`; failure injection (blocked tile URLs) shows blur-hold, no hole, no crash.
**Review checkpoint:** **[Owner]** blur-up watched on a throttled real device — it must read as a designed reveal, not a broken image loading.

### M1.6 — App binding: stores, `useEngine()`, deep-link boot

**Goal:** the engine is consumable the way the portfolio (and any client) will actually consume it.
**Scope:** the four zustand stores (`tour`, `viewer`, `ui`, `settings` — settings persisted); `useEngine()` binding in `apps/portfolio/app/`; viewer→store mirroring at ~10 Hz throttle; route skeleton (`/p/:project/pano/:pano` only, minimal chrome-less page hosting the viewer); deep-link boot with `?y&p&f` view params and throttled `replaceState` sync; the M1.1 dev harness retired in favor of this real binding.
**Explicitly out:** tour chrome, hotspot layer, Space Index, portfolio pages (Phases 2–3).
**Verify:** E2E: open a deep link → land on exact view (yaw/pitch/fov asserted via engine API); pan → URL updates throttled; reload → same view restored; React DevTools profile recorded during 10 s of continuous pan shows **zero** component re-renders (doc 06 §4).
**Review checkpoint:** binding code reviewed as the reference client implementation — this is the pattern every future engine adopter copies; store shapes match doc 02 §3.

### M1.7 — Instrumentation & Phase 1 performance verification

**Goal:** prove the Phase 1 exit gate with evidence, and settle the ADR-006 decode question.
**Scope:** dev stats HUD (fps, frame time, current level, memory estimate, idle-render counter); `scripts/perf-budget.mjs` v1 (chunk gzip sizes vs. doc 08 §3 — engine chunk actual vs. 330 KB ceiling recorded); Playwright perf spec (scripted pan frame-time trace, ±10% regression threshold) added to CI; **decode-hitch measurement** on mid-tier hardware per ADR-006 (fast pans while streaming 16K content; main-thread stalls attributed).
**Explicitly out:** fixing a failed decode measurement (that becomes a scheduled Phase 3 work item per doc 05, with these measurements attached) — unless it fails the Phase 1 gate outright, in which case it happens here.
**Verify:** CI runs budget + perf specs; HUD numbers cross-checked against Playwright traces once.
**Review checkpoint:** **Phase 1 exit gate (doc 05) reviewed as a whole, with recorded evidence:** 16K panorama on a mid-tier phone — first view < 2.5 s throttled, 60 fps pan while streaming, idle = 0 frames, memory in budget; engine unit harness green; ADR-006 decision documented (mitigation needed: yes/no + numbers). **[Owner]** sign-off closes Phase 1 and green-lights Phase 2 (transitions & hotspots — planned in the next plan document when we get there).

---

## Milestone dependency map

```
M0.0 → M0.2 → M0.3 ─────────────────────────┐
         │                                   │
         └→ M0.4 → M0.5 → M0.6 → M0.7 ═ Phase 0 gate
                     │              │
                     ▼              ▼
                   M1.1 → M1.2 → M1.4 → M1.5 → M1.6 → M1.7 ═ Phase 1 gate
                            ▲
                   M0.4 → M1.3 ──────┘ (parallel track, joins at M1.5)
```

Every arrow points backward in time only; no milestone waits on unfinished future work. M1.3 (pure domain) is the designated parallel track if a second workstream exists.
