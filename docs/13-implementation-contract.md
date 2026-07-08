# 13 — Implementation Contract

**Status: BINDING (2026-07-09).** This is the final document before coding begins. It defines the engineering rules **every future milestone must follow**. It changes no architecture, no ADR, and no design — where a frozen document (01–11) owns a topic, this contract defers to it and adds only the operational rule. Conflicts between this contract and the frozen docs are resolved in favor of the frozen docs and escalated to the owner.

A PR that violates this contract does not merge, regardless of how good the code is.

---

## 1. Coding philosophy

1. **The panorama images are the product; code only presents them.** When a decision trades code elegance against image fidelity, streaming speed, or interaction smoothness — the experience wins.
2. **Boring correctness over cleverness.** Write the obvious implementation first; earn complexity with a measurement (doc 08) or a spec requirement (doc 10).
3. **Delete-friendly code.** Small modules, explicit dependencies, no speculative abstraction. The rule of three: abstract on the third occurrence, not the first.
4. **Fail at the earliest possible moment.** Build time beats runtime; pipeline gate beats CI gate beats production error (ADR-010 is the model).
5. **The engine is a product** (doc 02 §6). Every engine API decision is made as if a stranger will consume it — because one day, one will.
6. **If it isn't tested or gated, it doesn't exist.** Claims about behavior, performance, or accessibility require evidence.

## 2. Definition of Done

A change is *done* only when **all** of the following hold:

- [ ] Behavior matches the frozen docs the change implements (cite them in the PR).
- [ ] Tests exist at the level doc 06 §8 assigns (domain unit / engine-math unit / component+axe / E2E), and pass.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` green locally; CI fully green.
- [ ] No performance budget (doc 08) or accessibility requirement (doc 09) regressed.
- [ ] Docs updated in the same PR if behavior described in `docs/` changed (clarifications only — architecture is frozen).
- [ ] For milestone-completing PRs: the milestone's review-checkpoint evidence is attached; [Owner] checkpoints have owner sign-off.
- [ ] No TODOs without an issue link; no commented-out code; no debug leftovers.

"Works on my machine," "will test later," and "temporary hack" are not states this project recognizes.

## 3. Review checklist (what the reviewer verifies, in order)

1. **Correctness** — does it do what the PR claims? Does the failure scenario in edge cases (empty manifest, missing tile, interrupted transition) behave per doc 02 §7?
2. **Frozen-doc conformance** — no architecture drift, no boundary violations beyond what lint catches, no unsanctioned tokens/components (doc 11 §2), no realtime-geometry scope.
3. **Contract conformance** — this document, sections 4–17.
4. **Test quality** — tests assert behavior, not implementation; the failure mode the change guards against is actually exercised.
5. **Readability** — a maintainer who wasn't in this conversation can follow it; names are domain names (doc 06 §2).

Style is never reviewed — Prettier and ESLint own it entirely.

## 4. Testing requirements

Owned by doc 06 §8; contract-level additions:

- **Coverage discipline by layer, not by number:** `domain/` ~100% branches; engine math (projection, kinematics, streamer priority/eviction) fully unit-tested; DOM components tested with Testing Library + vitest-axe; golden paths E2E on chromium + webkit.
- **Every bug fix ships with a regression test that fails on the pre-fix code.** No exceptions, including "obvious" fixes.
- **No mocking of PSV in engine tests** — engine behavior is verified against the real viewer in a real browser (doc 06 §8); mocks are allowed only at true externals (network, storage).
- **Deterministic tests only:** no sleeps as synchronization, no time-dependent assertions without fake timers, no network in unit tests.
- **A skipped test is a build failure** unless annotated with an issue link and an owner-approved reason.

## 5. Performance requirements

Owned by doc 08 — its budget tables are merge gates. Contract-level additions:

- **A budget is never raised in the same PR that needs it raised.** The amendment to doc 08 comes first, separately, owner-approved.
- Perf-relevant PRs (engine, streaming, transitions, chunks) must state their measured impact in the PR (numbers from the dev HUD, Playwright traces, or `perf-budget.mjs` — not adjectives).
- The frame-loop allocation rule (doc 06 §3/§4) is reviewed on every `useFrame`/render-loop-adjacent change, not just audited at phase gates.
- Regressions within budget still fail if > 10% on tracked perf specs (doc 08 §5) — budgets are ceilings, not targets.

## 6. Commit rules

- Conventional Commits, enforced by commitlint; sanctioned types: `feat fix perf refactor docs test build ci chore style revert content`.
- Subject ≤ 72 chars, imperative mood, references the milestone where applicable (`feat: add tile priority queue (M1.1)`).
- One logical change per commit; a commit must build and pass tests on its own (bisectability).
- Never `--no-verify`, never amend published history, never force-push `main`.
- Body explains *why* when the subject can't carry it; links issues with `Fixes #n` where applicable.

## 7. Pull Request rules

- One milestone (or a coherent slice of one) per PR — never two milestones, never "while I was here" changes.
- The PR template is filled completely; the frozen-architecture checklist is not theater — a checked box the diff contradicts is a review failure.
- PRs stay reviewable: target ≤ ~400 lines of non-generated diff; split otherwise (fixture/generated assets exempt but called out).
- Draft PRs for work-in-progress; a PR marked ready means "I believe this is done per §2."
- Content-only PRs (`content/…`): CI gates only, no code review (doc 06 §9); they may not touch anything outside `content-src/` and `apps/portfolio/public/projects/`.
- CI must be green before review is requested, not just before merge.

## 8. Error handling standards

The degradation policy (doc 02 §7) defines *what* happens; this defines *how* it's coded:

- **No silent catches.** Every `catch` either recovers meaningfully (per the degradation table), rethrows with context, or reports through the engine's `error` event / app error boundary. An empty catch block fails review.
- **Errors are typed.** The engine's public API emits typed error events (`code`, `message`, `recoverable`, context); the app maps codes to designed UI states — never raw messages to visitors (doc 11 §5: plain-language, actionable, always offering the Space Index as a path forward).
- **Validation errors are exhaustive, not first-failure** — the pipeline and manifest validator report everything wrong at once (artist-facing tooling respects the artist's time).
- **The visitor never sees a broken state:** no blank canvas, no hole in a panorama, no unstyled error text. Every failure path lands on a designed state (doc 11 §4).
- Impossible states are unrepresentable first (types, state machine), guarded second (assertions in dev builds), handled third.

## 9. Logging standards

- **Production is silent.** No `console.log` ships; no runtime telemetry, no third-party error services (ADR-011 privacy). `console.error`/`console.warn` are permitted only at the degradation paths defined in doc 02 §7, with stable, greppable prefixes: `[engine]`, `[loader]`, `[pipeline]`.
- **Dev builds are observable:** the dev HUD (M1.7) is the sanctioned surface for streaming/frame metrics; ad-hoc debug logging is fine locally but never committed.
- **Pipeline/scripts log for the artist:** progress, results, and exhaustive validation reports in plain language; failures exit non-zero with the fix spelled out.
- Log messages never include visitor data (there is none by design — keep it that way).

## 10. TypeScript standards

Owned by doc 06 §1; contract-level restatement of the non-negotiables:

- Compiler flags in `tsconfig.base.json` are frozen floor — they may strengthen, never weaken.
- `any` is banned; `as` requires an invariant comment; `@ts-expect-error` requires a reason string and is preferred over `@ts-ignore` (which is banned).
- `eslint-disable` comments require a reason and are per-line, never per-file; disabling a *boundary* rule requires owner approval in the PR.
- Public engine API: every export typed explicitly (no inferred public signatures), JSDoc on every export, no PSV types leaking (doc 02 §2.1).
- Branded types for units (`Radians`, `SceneId`, `TileKey` — doc 06 §1); new unit-carrying values get branded at introduction, not retrofitted.

## 11. Documentation standards

- `docs/01–11` are frozen: clarifications and factual corrections only, owner-approved, never silent redesign.
- Implementation docs (12, 13, reports) are living: kept current in the same PR as the change they describe.
- Code comments follow doc 06 §6: constraints and whys only ("upload cap >2/frame hitches iPhone 12 — measured"), never narration; measured numbers cite where they were measured.
- Every milestone-completing PR updates the root README **Status** section.
- Engine public API docs (JSDoc) are written for the future external adopter, not for teammates who share context.

## 12. Accessibility requirements

Owned by doc 09 — WCAG 2.2 AA and the parity principle are merge gates. Contract-level additions:

- axe checks (component-level and Playwright-level) are CI gates from the moment a surface exists — never retrofitted at phase end.
- Every interactive element ships with all six states (doc 11 §3) including `focus-visible`, in the same PR — keyboard support is not a follow-up.
- New UI copy ships with its screen-reader form (labels, live-region announcements) in the same PR.
- The Space Index parity rule is structural: any feature adding visitor-visible content must land it in the manifest/scene-index path in the same milestone, or the feature is incomplete.
- Reduced-motion behavior (docs 09 §4 / 10 §4) is implemented alongside each motion feature, not after it.

## 13. Browser support policy

- **Supported:** last 2 stable versions of Chrome, Edge, Firefox, Safari; iOS Safari and Android Chrome (doc 01 §4). WebGL2 required for the viewer; the Space Index works with no WebGL at all.
- **Verified:** Playwright runs chromium + webkit on every PR; the full matrix (incl. real iOS/Android hardware) at phase gates (doc 05).
- **No polyfill creep:** features outside the support matrix's native capability need a case-by-case decision, not an automatic polyfill; bundle budgets (doc 08 §3) price them.
- Safari is a first-class target, not a bug-report afterthought — webkit failures block merge exactly like chromium failures.

## 14. Dependency management policy

- **Adding any production dependency requires owner approval in the PR** — the dependency set is part of the frozen ADRs (the current set: PSV ×2, zod; react, react-dom, react-router, zustand, motion). Dev-tooling additions need a stated justification.
- `@photo-sphere-viewer/*` packages upgrade only in lockstep at identical versions (compatibility report F2); when the adapter is first imported, its `cubemap-adapter` peer is declared explicitly (F1).
- three.js is never a direct dependency (ADR-002) — a PR adding it is rejected on sight.
- Upgrades are their own PRs (`build:` type), with lockfile diff reviewed and full CI; no drive-by bumps inside feature PRs.
- `pnpm-lock.yaml` is always committed; CI installs `--frozen-lockfile`; new packages with install scripts require explicit `onlyBuiltDependencies` approval.
- No dependency for what ~30 lines of owned code can do (the engine's damping helpers are the precedent — ADR-007).

## 15. Refactoring policy

- **Refactors are separate PRs** (`refactor:`), behavior-preserving by definition, and prove it: the existing test suite passes unchanged (tests may be *added*, not adapted to new behavior).
- No refactor without a trigger: a milestone needs it, a measurement demands it, or the third duplication appeared (§1.3). "I didn't like it" is not a trigger.
- Public engine API refactors after M1.2 are breaking-change reviews — the API is a contract (doc 02 §6), version-disciplined even while internal.
- Renames/moves respect frozen folder structure (doc 03); a refactor that wants to move a boundary is an architecture change → owner escalation.
- Large refactors land as reviewable stages, each independently green — never a big-bang PR.

## 16. Security rules

- **No secrets in the repo, ever** — no tokens, keys, or credentials in code, config, CI files, or history. Secrets live in GitHub Actions secrets / local `.env.local` (git-ignored). A leaked secret is rotated immediately, not just deleted.
- **The static architecture is the security model** (ADR-001): no runtime backend, no visitor data collected, no cookies, no third-party runtime requests (ADR-011). Any change to that posture is an owner-level ADR.
- Supply chain: lockfile-pinned installs; GitHub Actions pinned at least to major versions and reviewed on bump; install scripts allowlisted (§14); `pnpm audit` reviewed at every phase gate and before release.
- Content is untrusted input to the *tools*: the pipeline and validator treat manifest/file content defensively (path traversal, malformed images) even though the artist is the only author today.
- Production headers at deploy (Phase 5): CSP consistent with self-hosted-everything, `X-Content-Type-Options: nosniff`, no referrer leakage beyond origin.
- No `eval`, no `new Function`, no `dangerouslySetInnerHTML` (manifest text renders as text; rich text, if ever needed, goes through a sanctioned parser — owner decision first).

## 17. Asset naming rules

Owned by doc 07; contract-level restatement for enforcement:

- Project and panorama ids: `kebab-case` slugs, stable once published (they are URLs — doc 01 F7). Renaming a published id is a breaking content change requiring owner sign-off.
- Panorama master files: `<panorama-slug>.<ext>` in `content-src/<project-slug>/panos/`.
- Pipeline outputs (never hand-named): `tiles/<contentHash>/<level>/<face>/<x>_<y>.<ext>`, `preview/<face>.<ext>`, `posters/<panorama-slug>[-thumb|-og].<ext>` — the content-hash segment is the cache-busting mechanism; stable paths otherwise.
- Fixture assets are named `fixture-*` and never resemble real project slugs.
- Fonts: `<family>-<subset>-<weight>.woff2` under `src/styles/fonts/`.

## 18. Folder ownership rules

Owned by doc 03; the ownership matrix that reviews enforce:

| Path | Owner | Others may |
|---|---|---|
| `docs/01–11` | Owner (frozen) | propose clarifications via PR |
| `docs/12, 13, reports/` | Engineering | edit with the change they describe |
| `packages/engine/` | Engineering — **portfolio-agnostic zone** | consume via public API only |
| `apps/portfolio/` | Engineering | — |
| `content-src/`, `public/projects/` | **Artist** | engineers touch only via pipeline/fixtures |
| `scripts/` | Engineering | artist runs, never edits |
| `.github/`, root configs | Engineering | changes are `ci:`/`build:`/`chore:` PRs, reviewed like code |

Cross-ownership changes in one PR (e.g., engine + app) are fine within a milestone; changes crossing into artist territory require the pipeline path, never manual edits.

## 19. Code review rules

- **Every code PR gets a review** against §3 before merge; content PRs are exempt (CI gates only); docs PRs need owner approval.
- Review turnaround target: within one working day; blocking findings are stated as *what would make this mergeable*, not just objections.
- The author never resolves a reviewer's thread — the reviewer confirms resolution.
- Findings of category "architecture conflict" stop the PR and go to the owner — neither author nor reviewer may waive the freeze.
- Review comments about style/formatting are invalid by definition (§3) — tooling owns style.
- Self-merge is permitted only for: content PRs (green gates), and `docs/12–13` bookkeeping updates — never for code.

## 20. Release checklist (per production deploy; Phase 5 defines the first)

- [ ] All milestone review checkpoints for the released scope are signed off (owner sign-off for [Owner] items).
- [ ] CI fully green on the release commit: lint, typecheck, tests, build, content validation, perf budgets, a11y suite, E2E (chromium + webkit).
- [ ] Doc 08 experience targets verified on real hardware for the release scope (mid-tier phone, throttled network).
- [ ] Doc 09 checklist passed: screen-reader parity walk, keyboard-only tour, reduced-motion pass.
- [ ] Content: every published project package validates; owner reviewed every panorama at full zoom (seams/banding/color — doc 07 §7).
- [ ] `pnpm audit` reviewed; no unaddressed high/critical advisories.
- [ ] Deploy artifacts: immutable cache headers on hashed assets, no-cache on HTML/manifests/discovery index (ADR-012); production headers per §16.
- [ ] Deep links spot-checked post-deploy (viewer + Space Index resolution, OG unfurls).
- [ ] Designed 404/offline pages reachable; WebGL-less fallback verified on the live site.
- [ ] Tag pushed (`vX.Y.Z`); README Status and docs 12/13 references updated; a rollback path exists (previous deploy retained).
- [ ] First 48 h: console/error reports checked once daily (the "quiet first 48 h" gate — doc 05).

---

**Adoption:** this contract is binding from milestone M0.2 onward. Amendments follow the same rule as everything else here: separate PR, owner approval, never bundled with the change that wants the amendment.
