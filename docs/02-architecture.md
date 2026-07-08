# 02 — Architecture

**Status: FROZEN (v3, 2026-07-08).**

## 1. Shape of the system

Virtual Gallery is a **fully static system in two parts**:

- **`@virtual-gallery/engine`** — a reusable, framework-free Panorama Engine package. It wraps **Photo Sphere Viewer (PSV) on three.js** as the rendering foundation (ADR-002) and owns everything experiential: scene management for the Building/Floor/Room hierarchy, hotspots, the Street View transition, tile streaming configuration, and a typed public API. It contains **zero portfolio knowledge**.
- **The portfolio app** — a React shell that is the engine's first client: premium UI, routing, Space Index, overlays. It consumes the engine only through its public API.

Content is **self-contained project packages** under `public/projects/` — pre-tiled imagery + validated JSON manifests — discovered automatically at build time (ADR-013) and streamed from the CDN.

```
┌──────────────────────────────────────────────────────────────────┐
│                            Browser                               │
│                                                                  │
│  ┌────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ PORTFOLIO APP (React)  │  │ @virtual-gallery/engine         │ │
│  │  — first engine client │  │  (pure TS, framework-free)      │ │
│  │                        │  │                                 │ │
│  │ Router · Home ·        │  │ ┌─────────────────────────────┐ │ │
│  │ Project pages ·        │  │ │ ViewerCore                  │ │ │
│  │ Tour chrome ·          │  │ │ Photo Sphere Viewer +       │ │ │
│  │ Wayfinding breadcrumb ·│  │ │ CubemapTilesAdapter         │ │ │
│  │ Space Index ·          │  │ │ (three.js underneath)       │ │ │
│  │ Hotspot DOM layer ·    │  │ └─────────────────────────────┘ │ │
│  │ Info panels · Loaders  │  │ ┌──────────────┐ ┌────────────┐ │ │
│  └───────────┬────────────┘  │ │ SceneManager │ │ Transition │ │ │
│              │               │ │ hierarchy ·  │ │ Director   │ │ │
│              │ engine public │ │ tour machine │ │ move-toward│ │ │
│              │ API (typed    │ │ · preload    │ │ -hotspot + │ │ │
│              │ commands +    │ │   policy     │ │ blend      │ │ │
│              │ events)       │ └──────────────┘ └────────────┘ │ │
│              ▼               │ ┌──────────────┐ ┌────────────┐ │ │
│  ┌────────────────────────┐  │ │ Hotspot      │ │ Project    │ │ │
│  │ State (zustand):       │◄─┤ │ System       │ │ Loader     │ │ │
│  │ tour · viewer · ui ·   │  │ │ (projection  │ │ (discovery │ │ │
│  │ settings               │  │ │  math + model)│ │ + manifest)│ │ │
│  └────────────────────────┘  │ └──────────────┘ └────────────┘ │ │
│                              └─────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
          ▲                                  ▲
          │ projects-index.json (generated)  │ tiles / previews / posters
   ┌──────┴──────────────────────────────────┴──────┐
   │        public/projects/<slug>/  on CDN         │
   │  project.json · tiles/<version>/… · posters    │
   └────────────────────────────────────────────────┘
```

## 2. The engine package (`packages/engine/`)

Framework-free TypeScript. Public API surface: `createPanoramaEngine(container, options)` returning a facade with typed commands (`loadProject`, `goToPanorama`, `lookAt`, `openInfo`, …) and events (`viewchange`, `panoramachanged`, `transitionstart/end`, `tileprogress`, `hotspotsprojected`). Everything else is internal.

### 2.1 ViewerCore (PSV integration)

Wraps **Photo Sphere Viewer** (`@photo-sphere-viewer/core` + `@photo-sphere-viewer/cubemap-tiles-adapter`), which handles the mature, solved problems: WebGL context management, equirect/cube projection, multi-resolution cube-tile loading by visibility, input basics, device quirks. We deliberately do not rebuild these (ADR-002).

What ViewerCore adds and owns:

- **Configuration as product:** damping/inertia tuned to doc 10 tokens, FOV and pitch limits per device class, DPR caps, `Save-Data`/low-tier profiles.
- **Motion character:** PSV's move/zoom behavior is normalized behind our API so keyboard, pointer, and programmatic motion share one critically-damped feel.
- **Streaming discipline on top of the adapter:** preview-first blur-up, neighbor-panorama preview prefetch (via SceneManager policy), and resident-preview guarantees for transitions.
- **Isolation:** PSV types never leak through the engine API; PSV's default UI (navbar, loader) is fully disabled — all UI is the client's. If PSV is ever replaced, only ViewerCore and TransitionDirector change (frozen decision; superseding ADR required).

### 2.2 SceneManager

Pure domain logic (no PSV imports):

- **Manifest model.** zod-validated: `Project → Building[] → Floor[] → Room[] → Panorama[]`, with panorama-level hotspots (`link | info`), initial views, per-link arrival views, tile metadata, optional floorplans. Panorama ids are project-unique; an indexed lookup provides O(1) resolution and reverse lookup (panorama → its room/floor/building) for wayfinding.
- **Tour state machine.** `idle → loading → viewing → transitioning → viewing …`; overlays (`indexOpen`, `infoOpen`) orthogonal. The only way panoramas change.
- **Preload policy.** On `viewing`, previews of all link-adjacent panoramas prefetch (cross-floor/building links included — a stairwell link preloads like any other). Budget-aware; respects `Save-Data`.

### 2.3 TransitionDirector (the signature system)

Implements F4 — *move toward the hotspot, then blend into the destination*; never a plain fade (except reduced-motion). Choreography per doc 10 §4:

1. Rotate view toward the hotspot direction while narrowing FOV (the forward-motion cue) — driven through ViewerCore's animation API on the live viewer.
2. Blend into the destination panorama (preview guaranteed resident, sharpening live) aligned to the authored arrival view; release FOV in the final phase.

**Implementation strategy (two tiers, decided by Phase 2 measurement):**
- *Tier A:* PSV's `setPanorama` transition options combined with our pre-move choreography. Ship if it meets the doc 10 spec on real content.
- *Tier B (planned fallback, not an unknown):* a second offscreen ViewerCore pre-warmed on the destination, composited over the live one with synchronized zoom during the blend. More code, full control; the engine API is identical either way.

Interruption-safe in both tiers: any input completes the swap immediately and returns control.

### 2.4 Hotspot System

The engine owns the hotspot *model* and the *projection math* (yaw/pitch → screen coordinates each `viewchange`, with visibility/behind-camera state). It emits `hotspotsprojected` events; **the client renders hotspots as DOM elements** (real `<button>`s in the portfolio — doc 09). The engine never builds DOM. PSV's markers system is not used (ADR-002) — DOM hotspots under design-system control do the accessibility and polish work.

### 2.5 Project Loader & Discovery

- Fetches the generated `projects-index.json` (list of discovered project packages — ADR-013), then individual `project.json` manifests on demand.
- Validates manifests at runtime with the same zod schemas the pipeline uses (defense in depth; the pipeline already gated them).
- Boots deep links directly into the target panorama and view.

## 3. The portfolio app (`apps/portfolio/`)

React DOM; consumes the engine facade via one `useEngine()` binding. Owns: routes (`/`, `/work`, `/p/:project`, `/p/:project/pano/:pano`, `/about`, `/contact`), portfolio pages built from the discovery index, tour chrome with the **wayfinding breadcrumb** (Building · Floor · Room, elided when singular — doc 01 §3.1), **Space Index** (hierarchical parity surface, doc 09), hotspot DOM layer, info panels, onboarding, settings, loaders.

State: four zustand stores (`tour`, `viewer`, `ui`, `settings` — persisted: settings only) bridge engine events to React; view params mirror at ~10 Hz for UI/URL, never per-frame re-renders (doc 06).

## 4. Content: the project package (contract)

A project is one self-contained folder — **the unit of publishing and the engine's content contract**:

```
public/projects/<slug>/
├── project.json          # manifest: hierarchy, panoramas, hotspots, views, tile metadata
├── tiles/<version>/…     # cube-tile pyramids + preview cubes (version = content hash → immutable caching)
└── posters/…             # posters/thumbs/OG images
```

Copy the folder in → build-time scan regenerates `projects-index.json` → deployed. Remove the folder → project disappears. No code, imports, or routes touched (F9). The package format is versioned (`formatVersion` in the manifest) so future engine versions can evolve it compatibly.

## 5. Data flow

1. **Authoring:** pipeline (doc 07) turns Lumion equirects + authored manifest into a finished package.
2. **Publish:** package copied into `public/projects/`; build scan emits `projects-index.json`; deploy.
3. **Portfolio entry:** shell renders instantly (no WebGL); project cards from the index (posters only).
4. **Entering a walkthrough:** engine chunk + `project.json` load in parallel → first panorama preview (< 300 KB) blur-up → `viewing` → adapter sharpens gaze direction → neighbor previews prefetch.
5. **Navigating:** hotspot → `transitioning` → TransitionDirector runs (≤ 100 ms start) → `panoramachanged` → URL + breadcrumb update → prefetch recomputes.
6. **Deep link:** `/p/:project/pano/:pano?y&p&f` boots straight into that view; hierarchy context derived from the manifest.

## 6. Critical architectural rules

- **The engine is a product.** No React, no portfolio imports, no app-specific behavior inside `packages/engine/`. Its API and the package format are the two public contracts.
- **PSV is load-bearing but contained.** Only ViewerCore/TransitionDirector import PSV; PSV types never cross the engine API; PSV default UI is disabled everywhere.
- **The engine decides, the client presents.** Scene logic, preloading, transition choreography = engine. Buttons, panels, text, routes = client.
- **DOM for anything readable or clickable.** WebGL is only for panorama pixels.
- **Every panorama has a poster and a preview.** Nothing ever waits on full-resolution imagery to show something designed.

## 7. Error and degradation policy

| Failure | Behavior |
|---------|----------|
| WebGL2 unavailable / context lost twice | Space Index mode with posters — full content parity (doc 09), plainly explained. |
| Tile request fails | Adapter retries; resident lower level keeps rendering (soft blur, never a hole); persistent failures logged. |
| A project package invalid at runtime | That project is excluded from the index/UI with a console report; other projects unaffected. (CI gates make this near-impossible for pipeline-built packages.) |
| Slow network | Progressive levels are the design; data-saver caps max level. |

## 8. Module dependency rules (lint-enforced)

```
packages/engine/domain/     → nothing app-internal (pure TS + zod)
packages/engine/viewer/     → domain, photo-sphere-viewer (+ three via PSV only)
packages/engine/(rest)      → domain, viewer internals; NO react, NO zustand
apps/portfolio/stores/      → engine public API, zustand
apps/portfolio/components/  → stores, engine public types; NO psv, NO three, NO engine internals
apps/portfolio/app/         → composition root
```

## 9. Future-proofing seams

- **Engine as npm package** (future vision): the workspace split *is* the seam — publishing is packaging work, not restructuring.
- **Manifest + package format as contract:** a visual editor/CMS emits packages; the engine doesn't change.
- **TransitionDirector tiers:** depth-assisted transitions (Lumion depth exports) extend Tier B compositing; API unchanged.
- **Input providers:** gyro (v1.x) and WebXR (future) integrate at ViewerCore without touching clients.
