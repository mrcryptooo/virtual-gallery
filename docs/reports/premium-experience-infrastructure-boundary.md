# Infrastructure Boundary Report — Profile System & Full Admin Panel

**Date:** 2026-08-20 · **Scope:** "Premium museum experience" milestone, requirements 2 (Profile System) and 4 (Admin Panel Foundation) · **Status:** report only — these two requirements are **not implemented**, by design, per the milestone's own explicit instruction to stop rather than fake authentication.

This report exists because the milestone spec required it: *"If a requirement requires backend infrastructure that the current project does not have: STOP at that boundary and report what is missing, why it is required, and what the safest implementation is."*

## What was checked before stopping

The current project (as of commit at the time of this milestone) is a **fully static, client-only architecture** (ADR-001, `docs/04-technical-decisions.md`), with exactly one real backend surface: a handful of Vercel serverless functions under `api/` (`api/submissions.ts`, `api/blob-upload.ts`, `api/screenshots.ts`, `api/screenshot-upload.ts`, `api/admin/submissions.ts`, `api/admin/screenshots.ts`). All persistence goes through **Vercel Blob** — a flat object store, not a database. There is no:

- User table or any relational/document database
- Session store, cookie-signing secret, or session middleware
- OAuth client library or OAuth callback handling
- Any existing authentication of any kind for end visitors (the `api/admin/*` routes are gated by a single shared bearer-token secret, `ADMIN_API_TOKEN` — this is an internal-tool gate, not a user-facing identity system, and it authenticates "the admin" as one shared secret, not individual admin accounts)

## Requirement 2 — Profile System (X/Twitter OAuth)

**What's missing:** a real OAuth 2.0 (PKCE) authorization-code exchange with X's API, which requires:

1. **An X/Twitter Developer App** with a Client ID and Client Secret, registered by the project owner (this cannot be created on the owner's behalf — it requires their X developer account and agreeing to X's API terms).
2. **A server-side OAuth callback handler** (a new `api/auth/callback.ts`-style route) that exchanges the authorization code for an access token using the Client Secret — the secret must never reach the browser, so this exchange has to happen in a serverless function, which the project does have the capability to host (the `api/` directory already works), but the route itself does not exist yet.
3. **A session mechanism**: after the OAuth exchange succeeds, the visitor needs a signed, httpOnly session cookie (or equivalent) so subsequent requests know who they are without re-running OAuth every time. This requires a session-signing secret and either (a) a database to store session state, or (b) a stateless signed-JWT session (still needs a signing secret managed server-side, and still benefits from a database to support revocation/logout).
4. **A persistent user table**: something has to remember `{ userId, displayName, avatarUrl, bio, twitterHandle, createdAt }` across requests and across the visitor's browser sessions. Vercel Blob can technically hold JSON files the same way `submissions/records/` does, but it has no indexing/query support — looking up "the user with this Twitter id" would mean listing and scanning every user record on every login, which does not scale and is not how a real user store should work. A real login system needs an actual database (e.g. Vercel Postgres, Neon, PlanetScale, or similar) — none is provisioned.

**Why it's required:** the milestone spec is explicit — "Use a proper authentication/session architecture… Do not expose private OAuth tokens to the frontend… If the current project does not yet have a real backend/auth provider capable of safely handling Twitter/X OAuth, STOP before inventing insecure client-side authentication." All four missing pieces above are exactly the things that make client-side-only "auth" insecure (a client-side "logged in" flag can be forged by anyone; a Client Secret shipped to the browser can be stolen and abused under the project's X app identity).

**Safest implementation path (for a future milestone, not this one):**

1. Provision a small relational/document database (Vercel Postgres is the least-friction choice given the project already deploys on Vercel — no new hosting relationship needed).
2. Register the X Developer App (owner action) and store `TWITTER_CLIENT_ID` / `TWITTER_CLIENT_SECRET` as Vercel environment variables (same pattern already established for `ADMIN_API_TOKEN`/`BLOB_READ_WRITE_TOKEN` — server-side only, never in a committed file).
3. Add `api/auth/login.ts` (redirects to X's authorize URL with PKCE) and `api/auth/callback.ts` (exchanges the code, creates/updates the user row, sets a signed httpOnly session cookie).
4. Add `api/auth/me.ts` (reads the session cookie, returns the current user's public profile fields only) and `api/profile.ts` (PATCH to edit `displayName`/`avatar`/`bio`, gated by the session, not by trusting a client-supplied user id).
5. Only then does a `ProfilePage.tsx` route become meaningful — until step 4 exists, any "profile page" in the frontend would necessarily be reading fake/local data, which is exactly the "insecure client-side authentication" the spec says not to build.

**What this milestone did instead:** the one piece of the profile story that doesn't require auth — the museum screenshot capture and its metadata schema (Requirement 3) — was built with a `userId: string | null` field on `ScreenshotRecord` specifically so that once the above exists, captures can be attributed to a real user with no schema migration. See `apps/portfolio/src/lib/community/types.ts`.

## Requirement 4 — Admin Panel Foundation (full RBAC)

**What exists today (built in Phase 2, reused/extended this milestone):** `api/admin/submissions.ts` and `api/admin/screenshots.ts`, both gated by `isAdminAuthorized()` (`api/_lib/adminAuth.ts`) — a single shared bearer-token secret checked against `process.env.ADMIN_API_TOKEN`. This is a real, working, fail-closed gate (no token configured → every request is refused; verified by tests), and it is genuinely useful as the read-API boundary for a future admin dashboard. But it is **one shared secret for "the admin"**, not individual admin accounts with roles/permissions — there is no login page, no admin user table, and no way to tell *which* admin made a request or to ever revoke one admin's access without rotating the secret for everyone.

**What's missing for real RBAC:**

1. Everything listed under Requirement 2 above (a database, a session mechanism) — an admin panel with actual accounts needs the same foundational pieces a visitor login needs, just with an `isAdmin` (or `role`) flag on the user row.
2. An admin login page/flow — could reuse the same X OAuth flow gated by an allow-list of Twitter user ids the owner designates as admins, or a separate email/password (or magic-link) flow if the owner would rather not require admins to have X accounts. Either way, it needs the database from Requirement 2.
3. Endpoints for the specific admin actions the spec lists (total users, registrations over time, museum visits, recent activity, moderation actions) — several of these (registrations, museum visits, "recent activity") also depend on data this project does not currently collect at all: there is no visit/session analytics of any kind today. That's a distinct gap from the auth gap — even with a database and real admin accounts, "museum visits" and "daily unique visitors" need an analytics/event-logging layer that doesn't exist yet (Vercel Web Analytics, or a custom lightweight event endpoint, would be the two realistic options).

**Why it's required:** same reasoning as Requirement 2 — the spec explicitly forbids "a fake password-protected frontend route" and requires "the admin route must not be accessible merely because somebody knows the URL," which a real RBAC system needs a database-backed session to guarantee (a client-side route guard alone can always be bypassed by calling the API directly, which is exactly why the current `api/admin/*` routes are gated server-side already — that part is correctly built, just not yet backed by individual accounts).

**Safest implementation path (for a future milestone, not this one):** builds directly on top of the Requirement 2 database/session work above — add an `isAdmin` boolean (or `role` enum) to the user table, gate `/admin` routes and `api/admin/*` by "valid session AND isAdmin", and only then retire the shared-secret `ADMIN_API_TOKEN` gate (or keep it as a secondary machine-to-machine credential for scripts, separate from human admin login).

## What this milestone built instead (the honest partial progress)

- `api/_lib/adminAuth.ts` — extracted the existing admin gate into a shared helper so both `api/admin/submissions.ts` and the new `api/admin/screenshots.ts` use one auth boundary, not a copy-pasted one per route. This is real, tested infrastructure that the eventual RBAC system can sit behind without a rewrite.
- `ScreenshotRecord`/`SubmissionRecord` both carry the fields a future admin dashboard needs to list/search/filter, per the milestone spec's own admin data-model ask ("Build the admin information architecture and the required data model/API boundaries" — done for submissions and screenshots specifically; user/visit/registration data cannot exist until Requirement 2's database does).
- `api/_lib/telegram.ts` — the notification foundation (Requirement 5) is fully built and wired to the two real-time events that exist today (`new-submission`, `new-screenshot`); it does not and cannot notify on "new user registration" or "daily unique visitors" yet, for the same reason the admin panel can't show those — the underlying user/analytics data doesn't exist yet.

## Bottom line

Nothing here was faked. No client-side "logged in" flag, no invented credentials, no admin route that merely hides itself behind a frontend check. The two requirements above are marked **NOT IMPLEMENTED** and blocked on the same missing piece of infrastructure (a real database + session mechanism), which is an owner-level infrastructure decision (which database provider, whether admins log in via X OAuth or a separate credential) rather than something to choose unilaterally mid-implementation.
