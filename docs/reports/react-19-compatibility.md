# Dependency Compatibility Report — React 19

**Date:** 2026-07-09 · **Scope:** M0.0 follow-up task 1 · **Status:** report only — no versions were changed.

**Method:** peer-dependency ranges and versions were read from the *installed* packages (lockfile-resolved `node_modules`), not from memory or registry metadata. React in use: **19.2.7**.

## 1. Runtime dependencies (apps/portfolio)

| Package | Installed | Declared React peer range | React 19 verdict |
|---|---|---|---|
| `react-dom` | 19.2.7 | `react ^19.2.7` | ✅ Exact match |
| `react-router` | 7.18.1 | `react >=18`, `react-dom >=18` | ✅ Compatible |
| `zustand` | 5.0.14 | `react >=18.0.0` (optional peer) | ✅ Compatible — v5 is the React-19-era line |
| `motion` | 12.42.2 | `react ^18.0.0 \|\| ^19.0.0` | ✅ Explicit React 19 support |
| `@types/react` | 19.2.17 | — | ✅ Matches React 19 |
| `@types/react-dom` | 19.2.3 | `@types/react ^19.2.0` | ✅ Satisfied |

## 2. Engine dependencies (packages/engine) — React-independent by design

The engine is framework-free (frozen boundary, doc 02 §8); none of its dependencies interact with React at all. Verified for completeness:

| Package | Installed | Notes |
|---|---|---|
| `@photo-sphere-viewer/core` | 5.14.3 | No React peer. Depends on `three ^0.184.0` (resolved: 0.184.0) — three arrives only via PSV per ADR-002 ✅ |
| `@photo-sphere-viewer/cubemap-tiles-adapter` | 5.14.3 | No React peer. See finding F1 below. |
| `zod` | 3.25.76 | No peers ✅ |

## 3. Tooling (dev-only — cannot affect the shipped app)

| Package | Installed | React 19 verdict |
|---|---|---|
| `@vitejs/plugin-react` | 4.7.0 | ✅ React-version-agnostic (peer is on Vite `^4–^7`); ships the automatic JSX runtime React 19 expects |
| `eslint-plugin-react-hooks` | 5.2.0 | ✅ Supports React 19 hooks semantics |
| `vite` 6.4.3, `vitest` 3.2.7, `typescript` 5.9.3, `typescript-eslint` 8.63.0, `eslint` 9.39.4 | — | ✅ React-agnostic |

## 4. Findings and recommendations

**Verdict: no React 19 compatibility concerns anywhere in the dependency tree.** Every package that touches React declares explicit React 19 (or `>=18`) support. No version changes are recommended for React compatibility.

Two adjacent (non-React) observations surfaced by the audit:

- **F1 — Undeclared transitive peer (severity: low).** `@photo-sphere-viewer/cubemap-tiles-adapter` declares a peer on `@photo-sphere-viewer/cubemap-adapter@5.14.3`, which we do not list in `packages/engine/package.json`. pnpm's auto-install-peers resolved it into the graph (visible in `pnpm-lock.yaml`), so nothing is broken — but resolution depends on a pnpm default rather than our manifest. **Recommendation:** when M1.1 first imports the adapter, add `@photo-sphere-viewer/cubemap-adapter` explicitly to the engine's dependencies at the same version. No action now (report-only per task instructions).
- **F2 — PSV version coupling (severity: low).** PSV adapters pin their core peer to the *exact* matching version (`5.14.3`). Our caret ranges (`^5.11.0`) work today because the lockfile resolves both to 5.14.3 together, but any future partial upgrade would break the pair. **Recommendation:** always upgrade all `@photo-sphere-viewer/*` packages in lockstep; consider pinning them to one shared exact version at M1.1.

**Forward-looking note (M0.3):** when component testing arrives, use `@testing-library/react` ≥ 16.3 — earlier majors predate React 19. Recorded here so the M0.3 PR doesn't rediscover it.
