# Virtual Gallery

**A reusable Panorama Engine — and the portfolio that is its first implementation.**

Visitors explore ultra-high-quality 8K/16K equirectangular renders (produced in Lumion) Street View-style: full-bleed panoramas, hotspot navigation, and cinematic scene-to-scene transitions. The panorama images are the product; the engine only presents them. No realtime 3D models, no GLB assets.

## Source of truth

The architecture is **frozen (v3)** and documented in [`docs/`](docs/README.md) — read [`docs/README.md`](docs/README.md) first. Implementation follows the milestone plan in [`docs/12-implementation-plan-phase-0-1.md`](docs/12-implementation-plan-phase-0-1.md). Code that conflicts with the docs is wrong by definition; conflicts escalate to the owner.

## Repository layout

| Path                              | What it is                                                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/engine/`                | `@virtual-gallery/engine` — the reusable, framework-free panorama engine (Photo Sphere Viewer foundation). No React, no portfolio knowledge. |
| `apps/portfolio/`                 | The artist's portfolio site (Vite + React 19) — the engine's first client.                                                                   |
| `apps/portfolio/public/projects/` | **Content drop zone**: self-contained project packages. Publishing = copy a folder here. Never hand-edited.                                  |
| `content-src/`                    | Artist territory: Lumion panorama masters + authoring manifests (pipeline input, never deployed).                                            |
| `scripts/`                        | Asset pipeline & CI gates (arrive in M0.4–M0.7).                                                                                             |
| `docs/`                           | Frozen product/architecture documentation.                                                                                                   |

## Prerequisites

- Node ≥ 22
- pnpm 10 (`npm i -g pnpm` or corepack)

## Commands

```bash
pnpm install        # install all workspaces
pnpm dev            # portfolio dev server
pnpm lint           # ESLint (incl. frozen boundary rules)
pnpm typecheck      # strict TS across workspaces
pnpm test           # unit tests (Vitest)
pnpm build          # full build
pnpm format         # Prettier
```

Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by commitlint via Husky); the extra `content` type is for content-only changes.

## Architecture rules

The architecture is **frozen (docs v3)**. The non-negotiables, enforced by lint where possible:

1. **Docs lead, code follows.** Reason from docs 01–11 before any change; a genuine conflict is escalated to the owner, never resolved silently in code.
2. **The engine is a product.** `packages/engine/` contains no React, no zustand, no portfolio knowledge; clients import only its public API (`@virtual-gallery/engine`) — deep imports fail lint.
3. **PSV is contained.** Only the engine's `viewer/` and `transition/` layers may import Photo Sphere Viewer; three.js arrives only via PSV; the app never imports either.
4. **Everything is content-driven.** Publishing a project = copying a package folder into `apps/portfolio/public/projects/`. If content requires a source change, that's an architecture bug.
5. **No realtime geometry.** No 3D models, meshes, or GLB — anywhere in the v1 line.
6. **Tokens only.** No colors, fonts, spacing, or motion values outside docs 10/11; amendments need owner approval.
7. **Budgets are gates.** Doc 08 performance budgets and doc 09 accessibility requirements block merges when violated.

## Development workflow

1. Pick the current milestone from [docs/12](docs/12-implementation-plan-phase-0-1.md) — work outside the active milestone doesn't start without owner agreement.
2. Re-read the frozen docs the milestone cites; branch from `main`.
3. Implement with tests alongside (see doc 06 §8 for what kind of test belongs where).
4. Verify locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm build` — Husky runs lint-staged and commitlint on every commit.
5. Open a PR using the template; fill in the milestone and the frozen-architecture checklist.
6. CI must be fully green — no skipped gates, no `--no-verify`, no disabled lint rules.

## Branch strategy

- **Trunk-based.** `main` is always deployable; there are no long-lived branches.
- Short-lived branches named by type: `feat/…`, `fix/…`, `perf/…`, `content/…`, `docs/…`, `chore/…` (e.g. `feat/m0.3-design-tokens`).
- **Squash-merge only**, with a Conventional Commit title; branches delete on merge.
- One milestone per PR (or a short series within one milestone) — never two milestones in one PR.

## Milestone workflow

Implementation follows [docs/12](docs/12-implementation-plan-phase-0-1.md): small milestones, each **independently buildable and testable**, depending only on completed earlier milestones.

- A milestone is _done_ when its **review checkpoint** passes — not when its code exists.
- Checkpoints tagged **[Owner]** require the artist's review (visual quality, motion feel); all others are self-verifiable via CI plus recorded evidence in the PR.
- Phase exit gates (end of Phase 0, Phase 1, …) are reviewed as a whole with evidence, and close the phase with owner sign-off.
- If a milestone surfaces a conflict with the frozen docs: stop, document it in the PR, escalate to the owner.

## Review process

| PR type                    | Review required                                                                                                                                                 |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Milestone / code           | CI green + code review against doc 06 + the PR checklist; milestone-completing PRs additionally need checkpoint evidence (and owner sign-off if [Owner]-tagged) |
| Content only (`content/…`) | CI content gates only (schema, files, alt text, link graph — ADR-010); no code review                                                                           |
| Docs                       | Owner approval — the architecture is frozen; only clarifications and corrections merge                                                                          |

Reviewers check, in order: correctness of behavior → frozen-doc conformance → test quality → readability. Style is not reviewed (Prettier/ESLint own it). Every bug fix must land with a regression test.

## Status

Milestone **M0.0 — Project Bootstrap** complete: repository foundation only. No engine code, no panorama code, no product UI yet — that begins at M0.3/M1.1 per the plan.
