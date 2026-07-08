# 03 — Folder Structure

**Status: FROZEN (v3, 2026-07-08).**

The repository is an npm workspace with two packages, reflecting the product philosophy: **the engine is the asset; the portfolio is its first client.**

```
virtual-gallery/
├── docs/                            # This documentation (source of truth)
│
├── packages/
│   └── engine/                      # @virtual-gallery/engine — REUSABLE, framework-free
│       ├── src/
│       │   ├── index.ts             # PUBLIC API — the only entry point clients may import
│       │   ├── PanoramaEngine.ts    # Facade: typed commands in, typed events out
│       │   ├── viewer/              # ViewerCore: PSV integration, motion tuning, profiles
│       │   ├── transition/          # TransitionDirector (Tier A + Tier B compositing)
│       │   ├── hotspots/            # Hotspot model + projection math (no DOM)
│       │   ├── domain/              # Pure TS: manifest zod schemas, hierarchy model,
│       │   │                        #   tour state machine, preload policy
│       │   └── loader/              # Discovery-index + manifest loading, deep-link boot
│       ├── test/                    # Engine unit harness + fixture packages
│       └── package.json             # deps: @photo-sphere-viewer/*, zod (NO react)
│
├── apps/
│   └── portfolio/                   # First engine client — the artist's site
│       ├── public/
│       │   └── projects/            # ★ CONTENT DROP ZONE — self-contained project packages
│       │       └── <project-slug>/
│       │           ├── project.json         # manifest (hierarchy → panoramas → hotspots)
│       │           ├── tiles/<version>/…    # cube-tile pyramids + preview cubes
│       │           └── posters/…            # posters, thumbs, OG images
│       ├── src/
│       │   ├── app/                 # Composition root: main.tsx, App.tsx, routes.tsx,
│       │   │                        #   useEngine() binding
│       │   ├── stores/              # zustand: tour, viewer, ui, settings
│       │   ├── components/
│       │   │   ├── ui/              # Design-system primitives
│       │   │   ├── portfolio/       # Home, ProjectCard, ProjectPage, About/Contact
│       │   │   ├── tour/            # TourChrome, Breadcrumb, HotspotLayer, ShareSheet
│       │   │   ├── space-index/     # Hierarchical parity mode (F5)
│       │   │   └── overlays/        # Onboarding, InfoPanel, Loaders, Settings
│       │   ├── styles/              # tokens.css, global.css, fonts/
│       │   └── lib/                 # Small utilities
│       ├── index.html
│       └── vite.config.ts           # includes project-discovery plugin (scan → index)
│
├── content-src/                     # ARTIST TERRITORY — pipeline INPUT (never deployed)
│   └── <project-slug>/
│       ├── panos/                   # Lumion equirect masters (8K/16K PNG/TIFF/JPEG)
│       └── project.authoring.json   # Hand-edited: hierarchy, names, descriptions, hotspots
│
├── scripts/                         # Pipeline & gates (doc 07)
│   ├── build-package.mjs            # content-src/<slug> → finished project package
│   ├── validate-packages.mjs        # Schema + files + text + link-graph gates
│   ├── pick-hotspots.mjs            # Dev viewer with yaw/pitch picker overlay
│   └── perf-budget.mjs              # Bundle/asset budget gate for CI
│
├── e2e/                             # Playwright specs (fixture project package)
├── .github/workflows/               # CI: lint → test → build → validate → budgets → deploy
├── package.json                     # npm workspaces root
└── tsconfig.base.json
```

## The discovery mechanism (F9, ADR-013)

`public/projects/` is scanned at **build time** by a Vite plugin (and watched in dev): every folder containing a valid `project.json` is added to a generated `projects-index.json` served alongside the app. Copying a package folder in (and redeploying) is the entire publishing act — **no source edits, no imports, no route changes**. Routes are already parametric (`/p/:project/…`); the index feeds the portfolio pages. An invalid package is excluded and reported, never breaking the build for other projects (it *does* fail CI validation so it can't merge unnoticed).

## Placement rules

1. **`packages/engine/` is portfolio-agnostic.** No React, no zustand, no app imports, no knowledge of routes or chrome. Clients import from `@virtual-gallery/engine` (the `index.ts` surface) only — engine internals are lint-blocked outside the package.
2. **Only `viewer/` and `transition/` may import Photo Sphere Viewer** (and three only arrives via PSV). PSV types never appear in `index.ts`.
3. **`content-src/` never deploys; `public/projects/` packages are never hand-edited.** Masters and authoring manifests are pipeline input; packages are pipeline output. Fixing content means re-running the pipeline, not editing tiles.
4. **`domain/` (in the engine) imports nothing but zod.** Hierarchy logic, tour machine, and preload policy stay headless and unit-testable.
5. **`components/` never imports PSV, three, or engine internals** — engine access via stores and `useEngine()` only.
6. **One component/class per file; tests co-located.** E2E specs named by journey.
7. **No `utils/` dumping ground** — `lib/` only for code used by ≥ 2 layers; engine-shared helpers live inside the engine.
