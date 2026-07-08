# 04 — Technical Decisions (ADRs)

**Status: FROZEN (v3, 2026-07-08). All ADRs below are ACCEPTED.** Changes require a new superseding ADR approved by the owner. (History: the v1 ADR set described a realtime-3D gallery and was rejected pre-acceptance; v2 proposed a fully custom renderer, revised at the v3 final review per owner direction; ADR-002 records that revision.)

---

## ADR-001 — Fully static, client-only architecture — **accepted**

**Decision.** Static site + CDN. No server runtime. Content is validated JSON manifests plus pre-tiled imagery in self-contained project packages.
**Consequences.** Zero ops; immutable-cacheable tiles; hosting is a commodity. A future editor/CMS emits packages; nothing else changes.
**Alternatives.** SSR (no dynamic data to serve); runtime image services (projection-aware tiling can't be delegated to generic image CDNs).

## ADR-002 — Photo Sphere Viewer on three.js as the viewing foundation; our engine on top — **accepted** *(revised at v3 review from "fully custom renderer")*

**Context.** v2 proposed building the tiled panorama renderer from scratch for maximal control. Owner direction at final review: **do not reinvent a mature panorama renderer** — keep control over the *experience*, not the plumbing.
**Decision.** Use **Photo Sphere Viewer 5.x** (`@photo-sphere-viewer/core`, three.js-based) with the **`cubemap-tiles-adapter`** for multi-resolution cube-tile streaming. Build our own architecture on top: SceneManager (hierarchy, tour machine, preloading), Hotspot System (model + projection; DOM rendering by clients), TransitionDirector, motion tuning, profiles, and the public engine API. PSV's built-in UI (navbar, loader, markers) is disabled/unused — every visible element is ours.
**Consequences.** We inherit years of solved problems (projection math, tile visibility resolution, context/device quirks, input basics) and cut Phase 1 risk and duration (doc 05). We accept: PSV's API shapes ViewerCore's internals; the transition spec must be achieved through/around PSV (two-tier strategy, doc 02 §2.3); PSV pulls the full three build (engine chunk budget sized accordingly, doc 08). Containment rule: only `viewer/` and `transition/` import PSV; PSV types never cross the engine API — replacing PSV, if ever needed, is a contained rewrite behind a stable contract (and requires a superseding ADR).
**Alternatives.** Fully custom renderer on a three core (v2 plan — maximal control, weeks of rendering plumbing, all device-quirk risk ours; rejected by owner); Marzipano (best-in-class tiling but effectively unmaintained, ES5-era); Pannellum (equirect-focused, weaker multi-res cube story); raw WebGL (worst risk/reward).

## ADR-003 — Vite + React 19 + TypeScript (strict); npm-workspace split: engine package + portfolio app — **accepted**

**Decision.** Workspace: `packages/engine` (framework-free TS; deps: PSV, zod) and `apps/portfolio` (React 19). TypeScript `strict` + `noUncheckedIndexedAccess` everywhere. Vite builds the app; the engine is consumed as a source workspace dependency in v1 (published npm package is future vision). Chunking: shell (no PSV/three) / engine (lazy) / manifests as data.
**Consequences.** The reusability requirement (doc 01 §4) is structural, not aspirational: the engine cannot silently grow portfolio dependencies. Space-Index-only and no-WebGL visitors never download the engine chunk.
**Alternatives.** Single-package `src/engine/` folder (boundary by lint only — too weak for a product whose *point* is the reusable engine); separate repos (premature process overhead).

## ADR-004 — Multi-resolution tiled cube map as the delivery projection — **accepted**

**Context.** 8K/16K equirect masters exceed GPU texture limits and waste memory on unseen pixels; Street View solved this with visible-tile streaming. PSV's `cubemap-tiles-adapter` consumes exactly this format.
**Decision.** The pipeline re-projects each equirect into 6 cube faces sliced into a quadtree pyramid (512-px tiles; face sizes: 16K master → 4096 with levels 512/1024/2048/4096; 8K → 2048). Per panorama additionally: a 6×256 **preview cube** (blur-up base, transition source, prefetch unit, ≤ ~300 KB) and 2D **posters/thumbs** for cards, Space Index, and OG images.
**Consequences.** First view fast regardless of source size; full fidelity where the visitor looks; GPU memory bounded by view. Tile naming/layout follows the adapter's URL-template contract (doc 07).
**Alternatives.** Single equirect texture (fails GPU limits at 16K); server-side tiling (violates ADR-001).

## ADR-005 — Tile/image formats: AVIF with WebP fallback — **accepted**

**Decision.** Tiles, previews, posters: AVIF (quality rising with level depth; 4:4:4 at the deepest level) + WebP fallback, negotiated via manifest-listed variants. sRGB throughout; ICC stripped. **Banding gate:** gradient regions compared against masters; visible posterization fails the pipeline (per-scene `"quality": "max"` override available).
**Consequences.** ~35-50% smaller than JPEG at equal quality on CGI content. GPU memory is uncompressed regardless of wire format — bounded by the adapter's resolution logic and our profiles (doc 08).
**Alternatives.** JPEG (bigger, bands on skies); KTX2/Basis (GPU-memory savings don't justify visible quality risk on hero imagery in a view-limited system).

## ADR-006 — Decode and network behavior — **accepted**

**Decision.** Tile fetch/decode rides PSV's adapter pipeline; our layer adds: preview-first ordering, neighbor-preview prefetch (SceneManager policy), `Save-Data`/low-tier level caps, and an abort-stale-requests policy on rapid navigation. If Phase 1 measurement shows main-thread decode hitching pans on mid-tier devices, the committed mitigation is a custom adapter subclass routing decode through `createImageBitmap` in a worker — an internal change behind ViewerCore.
**Consequences.** We adopt proven loading behavior first and hold a measured, contained escape hatch rather than pre-building one.

## ADR-007 — Animation: engine-internal damping for camera/transitions; Motion (Framer Motion) for DOM chrome — **accepted**

**Decision.** All camera/transition motion is computed inside the engine (through ViewerCore's normalized animation layer) with critically-damped, delta-time-based interpolation — interruptible always; no tween library in the engine. DOM overlays use Motion, fed by the shared motion tokens (doc 10 §2). One token definition, mirrored to CSS and engine constants.
**Alternatives.** GSAP (imperative timelines fight interruption-first motion; licensing consideration); CSS-only chrome (insufficient choreography).

## ADR-008 — Routing: react-router v7 (library mode); flat panorama deep links — **accepted**

**Decision.** Routes: `/`, `/work`, `/p/:project`, `/p/:project/pano/:pano`, `/about`, `/contact`. Panorama ids are project-unique, so deep links are flat; hierarchy context (building/floor/room) derives from the manifest, keeping URLs short and stable even for huge projects. View direction in query params via throttled `replaceState`. The viewer never remounts within a project. **Routes are parametric and content-agnostic — adding projects never touches them (F9).**
**Alternatives.** Hierarchical URLs `/p/:project/:building/:floor/:room/:pano` (verbose, breaks when content is reorganized — panorama ids are the stable contract); TanStack Router (fine; familiarity).

## ADR-009 — State: zustand in the app; typed tour state machine in the engine — **accepted**

**Decision.** The tour state machine and hierarchy model live in the engine's `domain/` (fully-typed transition table; XState-style rigor without the dependency). The portfolio's four zustand stores (`tour`, `viewer`, `ui`, `settings` — settings persisted) subscribe to engine events; view params mirror at ~10 Hz for UI/URL. **The engine itself has no zustand** — clients bring their own state layer; the engine only emits events.
**Alternatives.** zustand inside the engine (couples clients to our state choice); Redux/XState (weight without benefit at this scale).

## ADR-010 — Manifests validated by zod; the package format is a public contract — **accepted**

**Decision.** zod schemas in the engine's `domain/manifest/` define `Project → Building → Floor → Room → Panorama` (+ hotspots, views, tiles, semver `schemaVersion`). The pipeline validates at package build; CI validates all of `public/projects/`; the engine re-validates at load (defense in depth — packages can be dropped in by hand per F9). Gates: schema; tile/preview/poster existence; hotspot targets resolve; **names, descriptions, and poster alt text required — missing text fails validation**; link-graph connectivity (no orphan panoramas); id uniqueness.
**Consequences.** The schema + package layout is the contract for future editors, CMSes, and other engine adopters; semver `schemaVersion` gives it an evolution path (renamed from `formatVersion` by owner amendment, 2026-07-09).

## ADR-011 — Privacy: self-hosted everything — **accepted**

**Decision.** Fonts subsetted and self-hosted; all assets from our CDN; zero third-party runtime requests. Analytics, if ever, cookieless/self-hosted via a new ADR.

## ADR-012 — Hosting/CI: GitHub Actions → static CDN host — **accepted**

**Decision.** Pipeline: lint → typecheck → unit/component tests → build (discovery scan included) → package validation → performance budgets → Playwright smoke → deploy. Host: **Cloudflare Pages** (confirmed default). Caching: app assets hashed by Vite (immutable, 1 y); project-package tiles live under `tiles/<contentHash>/…` so their URLs are content-addressed — long-cache safe without Vite hashing (packages sit in `public/`); `project.json` and `projects-index.json` served no-cache.

## ADR-013 — Drop-in project publishing via build-time auto-discovery — **accepted**

**Context.** F9: adding a project must require only copying a folder into `public/projects/` — no source changes, no imports, no route modifications. A static host cannot enumerate directories at runtime.
**Decision.** A Vite plugin scans `public/projects/*/project.json` at build time (and watches in dev) and emits a generated **`projects-index.json`** (slugs, titles, covers, package versions). The app reads only this index; routes are parametric. Copy folder → redeploy → live. Invalid packages are excluded from the index with a report (and fail CI validation so they can't merge silently).
**Consequences.** "Automatic discovery" is honest on static hosting: the scan is part of every build, and publishing is a pure content operation. The generated index is never hand-edited.
**Alternatives.** Hand-maintained index file (violates F9's spirit — a forgotten edit is a silent failure); runtime directory probing (impossible on static hosts); a manifest service (violates ADR-001).

## ADR-014 — Hierarchical content model with flat panorama namespace — **accepted**

**Context.** Very large architectural projects need spatial organization (doc 01 §3.1); links and URLs need stability.
**Decision.** The manifest nests `Building → Floor → Room → Panorama` for organization, wayfinding, and the Space Index; **panorama ids are project-unique and flat** — hotspot links and deep links reference panoramas directly, and may cross rooms, floors, and buildings. The engine maintains bidirectional indexes (panorama ⇄ hierarchy path). UI elides singular levels.
**Consequences.** Reorganizing hierarchy (renaming a floor, moving a room) never breaks links or shared URLs; wayfinding stays derivable; small projects don't pay a complexity tax.
**Alternatives.** Hierarchy-addressed panoramas (reorganization breaks every link); flat scene list with tags (v2 model — insufficient for multi-building navigation).
