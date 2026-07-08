# Virtual Gallery — Documentation

> **🔒 ARCHITECTURE FROZEN — v3, 2026-07-08.**
> This documentation set was approved and frozen by the owner. All ADRs are **accepted**. No further architecture changes are permitted; only clarifications, corrections of factual errors, and post-v1 roadmap additions may be made, each requiring owner sign-off. Feature work that conflicts with these documents is out of scope by definition.

## What this product is

**Virtual Gallery is a reusable Panorama Engine** — a premium web-based immersive panorama walkthrough system inspired by Google Street View — **and a portfolio website that is the engine's first implementation.**

The owner is a CGI artist producing ultra-high-quality 8K/16K equirectangular renders in Lumion. Visitors explore those rendered environments by looking around full-bleed panoramic scenes and moving between them through hotspots with smooth, Street View-style transitions.

Core philosophy, in priority order:

1. **The panorama images are the product; the engine only presents them.** No realtime 3D models, no GLB assets, no interactive meshes in the v1 line.
2. **The engine is the asset; the portfolio is its first client.** Engine code is written as a reusable, portfolio-agnostic package with a clean public API.
3. **Everything is content-driven.** Publishing a project means copying a self-contained folder into `public/projects/` — zero source-code changes, zero imports, zero route edits.
4. **Mature foundations, owned experience.** Rendering rests on Photo Sphere Viewer over three.js; the architecture, UX, scene management, navigation, and transitions are ours.

## Reading order

| # | Document | What it defines |
|---|----------|-----------------|
| 01 | [Product Requirements](01-product-requirements.md) | Product definition (engine + first implementation), personas, features, hard exclusions. |
| 02 | [Architecture](02-architecture.md) | Engine package (PSV-based viewer core, Transition Director, Tile strategy), Scene Manager with the Building→Floor→Room hierarchy, Project Discovery, Portfolio Shell. |
| 03 | [Folder Structure](03-folder-structure.md) | Workspace layout (engine package + portfolio app), the self-contained project package format, placement rules. |
| 04 | [Technical Decisions](04-technical-decisions.md) | Accepted ADRs: Photo Sphere Viewer, tiled cube-map delivery, drop-in project discovery, hierarchy model, and the rest. |
| 05 | [Development Roadmap](05-roadmap.md) | Phases with exit gates: pipeline proof → viewer integration → transitions & tour → portfolio & a11y → real content → launch. |
| 06 | [Coding Standards](06-coding-standards.md) | TypeScript/React/engine conventions, package boundaries, testing, git. |
| 07 | [Asset Pipeline](07-asset-pipeline.md) | Lumion equirect → tiled cube-map project package; artist publishing runbook; discovery index. |
| 08 | [Performance Requirements](08-performance.md) | Hard budgets: first view < 2.5 s, 60 fps pan, ≤ 100 ms transition start, tile/memory budgets. |
| 09 | [Accessibility Requirements](09-accessibility.md) | WCAG 2.2 AA; hierarchical Space Index content parity; DOM hotspots; reduced-motion rules. |
| 10 | [Animation Guidelines](10-animation-guidelines.md) | Motion tokens, viewer damping rules, the signature Street View transition spec and its implementation strategy. |
| 11 | [Design System](11-design-system.md) | Dark-first cinematic-minimalism tokens, component inventory, states, imagery and copy rules. |

## Implementation (not part of the architecture freeze)

| # | Document | What it defines |
|---|----------|-----------------|
| 12 | [Implementation Plan: Phase 0 → 1](12-implementation-plan-phase-0-1.md) | Milestone-level execution plan implementing the frozen architecture — small, independently buildable and testable milestones, each ending in a review checkpoint. |

## Governance rules

1. **Docs lead, code follows.** Before writing or changing any component, engine module, or copy, reason from these documents. Under the freeze, a genuine conflict is escalated to the owner — never silently resolved in code.
2. **Budgets are gates, not aspirations.** The numbers in [08-performance.md](08-performance.md) and the requirements in [09-accessibility.md](09-accessibility.md) block merges when violated.
3. **New tokens require a design-system change.** No colors, fonts, spacing, motion timings, or component shapes outside [11](11-design-system.md)/[10](10-animation-guidelines.md) without owner-approved amendment.
4. **ADRs are append-only.** All current ADRs are accepted and frozen; a change requires a new superseding ADR approved by the owner.
5. **No realtime geometry.** Any feature requiring 3D models, meshes, or GLB content is outside the v1 line entirely.
6. **Engine/app separation is inviolable.** Nothing portfolio-specific may enter the engine package; the portfolio consumes the engine only through its public API.

## Document history

- **v1** (2026-07-08) — realtime-3D walkable gallery concept. Rejected at product review.
- **v2** (2026-07-08) — panorama walkthrough engine, custom renderer. Approved in direction.
- **v3** (2026-07-08) — final adjustments: Photo Sphere Viewer foundation, Building/Floor/Room hierarchy, drop-in content-driven projects, engine-first philosophy. **Approved and frozen.**
