# 06 — Coding Standards

**Status: FROZEN (v3, 2026-07-08).** Conventions for all code in `packages/`, `apps/`, and `scripts/`. Anything the linter can enforce, the linter does — review time is for design, not style.

## 1. TypeScript

- `strict: true`, plus `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes` (shared `tsconfig.base.json`).
- **No `any`.** `unknown` + narrowing at boundaries (manifest parsing, PSV event payloads). `as` casts require a comment stating the invariant that makes them safe.
- Content types are defined once in the engine's `domain/manifest/` and imported everywhere; app code never redeclares content shapes.
- Discriminated unions over boolean flags (`{ status: 'viewing' } | { status: 'transitioning'; to: PanoramaId }`) so impossible states don't typecheck.
- No enums; `as const` objects or union literals. `interface` for extendable shapes; `type` otherwise.
- Branded types for unit-heavy values: `Radians`, `Degrees`, `PanoramaId`, `ProjectSlug` — yaw/pitch bugs are unit bugs.

## 2. Naming & files

- Components `PascalCase.tsx`; engine classes `PascalCase.ts`; hooks `useCamelCase.ts`; stores `camelCaseStore.ts`; everything else `kebab-case.ts`.
- Tests co-located (`Foo.test.ts(x)`); E2E specs named by journey (`navigate-tour.spec.ts`).
- Name by domain role: `TransitionDirector`, not `PanoBlender`; `arrivalView`, not `endYawPitch`.
- Content ids (project slugs, building/floor/room/panorama ids) are `kebab-case`, and panorama ids are stable once published — they are URLs (F7).

## 3. Engine code (`packages/engine/`) — the strictest zone

The engine is a product with external consumers (doc 01 §2). Its standards are library standards:

- **Public API discipline.** Everything importable by clients lives in `src/index.ts`; internals are lint-blocked outside the package. Every exported type/function has JSDoc. Breaking the API surface requires a changelog entry from day one — the habit precedes the npm package.
- **No React, no zustand, no DOM construction** (the engine receives a container element and may measure it; it never builds UI). No portfolio knowledge of any kind.
- **PSV containment (ADR-002):** only `viewer/` and `transition/` import `@photo-sphere-viewer/*`; three arrives only via PSV; PSV types never appear in the public API. `domain/` imports nothing but zod.
- **Interaction paths allocate nothing.** Code running per `viewchange`/per animation tick creates no objects/arrays/closures; scratch objects are instance fields. Enforced by review + heap-profile spot checks (Phases 1/4).
- All engine motion is delta-time based and frame-rate independent, via the shared damping helpers — no `*= 0.9`-style decay.
- Every PSV/viewer resource is created and destroyed through ViewerCore's tracked lifecycle; `destroy()` leaves no listeners, observers, or GL contexts behind (asserted in the unit harness).
- Events out, commands in — clients never poll engine internals; the engine never calls into client code except through subscribed events.

## 4. App code (`apps/portfolio/`)

- Function components only; composition over configuration props.
- zustand access via selectors — never subscribe to a whole store. View params (`viewerStore`) update at ~10 Hz throttle; anything needing smoother values reads via `subscribe` in a ref/effect, not re-render.
- Derived data is computed, not stored. No `useEffect` for events or derivations; effects only for genuine external synchronization (the `useEngine()` binding is the canonical example).
- Interactive elements are native (`button`, `a`) or fully wired ARIA per doc 09; divs with onClick fail review. Hotspots are real `<button>`s.
- No component may cause per-frame React re-renders. Render churn during pan or transition is a bug by definition.
- Content-driven means content-blind: no component may reference a specific project, building, or panorama id (F9). Fixture ids appear only in tests.

## 5. Package & layer boundaries (lint-enforced via `eslint-plugin-boundaries` + workspace deps)

- `packages/engine` — deps: PSV, zod only. Internal layering per doc 02 §8 (`domain/` pure; `viewer/`+`transition/` own PSV).
- `apps/portfolio/components/` — no `@photo-sphere-viewer/*`, no `three`, no `@virtual-gallery/engine/src/*` deep imports (public API only).
- `apps/portfolio/stores/` — engine public API + zustand only.
- `apps/portfolio/app/` — composition root; the only place engine, stores, and shell meet.
- `scripts/` — Node-only; may import the engine's `domain/manifest` schemas (single source of validation truth).

## 6. Comments & docs

- Comments state constraints the code can't express ("PSV fires `position-updated` before `zoom-updated`; the projector must read both in one frame"), never narrate lines.
- Coordinate conventions (yaw origin, direction of positive pitch, PSV's sphere orientation) are documented once in `hotspots/projection.ts` and referenced, never restated.
- A change that alters behavior described in `docs/` updates the doc in the same PR — under the freeze, that means clarifications only; conflicts escalate to the owner.

## 7. Formatting & linting

- Prettier defaults (2-space, single quotes, trailing commas, 100-col). Config frozen.
- ESLint flat config: `typescript-eslint` strict-type-checked, `react-hooks`, `jsx-a11y` (error), `boundaries`. Warnings are errors in CI.

## 8. Testing standards

- **Engine domain** (manifest/hierarchy model, tour machine, preload policy, projection math): unit-tested to ~100% branches — pure and cheap.
- **ViewerCore/TransitionDirector**: integration-tested against fixture packages in a real browser (Playwright component runner) — PSV behavior is exercised, not mocked; mocks of PSV are forbidden (they test our assumptions, not the integration).
- **Rendering correctness**: Playwright screenshot comparisons of deterministic views of the fixture package (seams, level blending, transition midpoint), tolerance-based, chromium + webkit.
- **App components**: Testing Library + vitest-axe, including full Space Index a11y assertions.
- **E2E golden paths**: portfolio → project → pan → hotspot → transition → cross-floor link → deep link → Space Index parity.
- Behavior over implementation; every bug fix lands with a regression test.

## 9. Git & PR conventions

- Trunk-based; short-lived branches `feat/…`, `fix/…`, `perf/…`, `content/…`, `docs/…`; `main` always deployable; squash-merge, Conventional Commits.
- Content-only PRs (`public/projects/` packages) need only the package CI gate, no code review.
- Engine-touching PRs state their API impact (none / additive / breaking) in the description.
- CI green before merge — including performance budgets (doc 08) and the a11y suite (doc 09). No `--no-verify`, no skipped gates.
