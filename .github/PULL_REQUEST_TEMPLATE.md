# Pull Request

## What & why

<!-- One or two sentences. Link the issue if one exists. -->

## Milestone

<!-- Which docs/12 milestone does this belong to? e.g. "M0.3 — Design tokens & base primitives".
     One milestone per PR. Content-only PRs: write "content" instead. -->

## Type

- [ ] Milestone work (code/tests/scripts per docs/12)
- [ ] Content only (`apps/portfolio/public/projects/` or `content-src/` — no code review needed, CI gates apply)
- [ ] Docs (clarification/correction only — the architecture is frozen)
- [ ] Tooling/CI

## Frozen-architecture checklist

- [ ] I reasoned from the frozen docs (01–11) before writing this change
- [ ] No conflict with a frozen decision — **or** a conflict exists and is escalated to the owner in this PR's description (not resolved silently)
- [ ] No new colors/fonts/spacing/motion values outside docs 10/11
- [ ] Engine ↔ app boundaries respected (lint enforces; no rule was disabled)
- [ ] No realtime-3D/geometry scope introduced

## Verification

<!-- What proves this works? Test names, commands run, device checked, screenshots/recordings
     for anything visual. Milestone PRs: state which part of the milestone's "Verify" list this covers. -->

## Review checkpoint

- [ ] This PR completes a milestone → the milestone's **review checkpoint** evidence is included above (owner sign-off required for [Owner]-tagged checkpoints)
- [ ] This PR is intermediate work within a milestone
