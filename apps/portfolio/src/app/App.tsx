import { lazy, Suspense } from 'react';
import { DevTokensPage } from './DevTokensPage';
import { HeroDevPage } from './HeroDevPage';
import { LandingPage } from './LandingPage';

// Lazy: the tour page pulls the engine (PSV + three) — it must stay out of
// the shell chunk (doc 08 §4). Visitors who never open a tour never load it.
const TourPage = lazy(() => import('./TourPage').then((module) => ({ default: module.TourPage })));

// Lazy: Competition/Submit are secondary routes visited far less than the
// landing page. SubmitArtPage in particular pulls in @vercel/blob/client's
// upload machinery, which the landing bundle has no reason to carry.
const CompetitionPage = lazy(() =>
  import('./CompetitionPage').then((module) => ({ default: module.CompetitionPage })),
);
const SubmitArtPage = lazy(() =>
  import('./SubmitArtPage').then((module) => ({ default: module.SubmitArtPage })),
);

// Lazy for the same reason: /profile and /admin are visited by a small
// minority of visitors (signed-in users, and admins respectively) and
// have no reason to be in the landing page's own bundle.
const ProfilePage = lazy(() =>
  import('./ProfilePage').then((module) => ({ default: module.ProfilePage })),
);
const AdminPage = lazy(() =>
  import('./AdminPage').then((module) => ({ default: module.AdminPage })),
);

/**
 * Routes served by the Marzipano static export rather than this SPA. The
 * server rewrites them before React ever loads (vercel.json in production,
 * a matching dev middleware in vite.config.ts); this guard is a safety net so
 * the engine can never take the route if a rewrite is missing.
 */
const STATIC_TOUR_ROUTES = new Set(['modern-museum']);

/**
 * Route handling is deliberately minimal until M1.6 (react-router + deep
 * links + URL view sync). Recognized today:
 *   /                   → landing page (Seismic Stone hero)
 *   /p/<project-slug>   → walkthrough (engine-rendered projects)
 *   /competition        → Competitions (coming soon)
 *   /submit             → Submit Your Art
 *   /profile            → signed-in visitor's own profile + gallery
 *   /admin              → admin panel (server-side RBAC; see api/_lib/adminAuth.ts)
 *   /dev/tokens         → design-system showcase (dev builds only)
 *   /dev/hero           → isolated Seismic Stone dev harness (dev builds only)
 */
export function App() {
  const path = window.location.pathname;

  if (import.meta.env.DEV && path === '/dev/tokens') {
    return <DevTokensPage />;
  }

  if (import.meta.env.DEV && path === '/dev/hero') {
    return <HeroDevPage />;
  }

  const staticMatch = /^\/p\/([a-z0-9-]+)\/?$/.exec(path)?.[1];
  if (staticMatch !== undefined && STATIC_TOUR_ROUTES.has(staticMatch)) {
    window.location.replace(`/tour/${staticMatch}/index.html`);
    return null;
  }

  const tourMatch = /^\/p\/([a-z0-9-]+)\/?$/.exec(path);
  if (tourMatch?.[1] !== undefined) {
    return (
      <Suspense fallback={null}>
        <TourPage projectSlug={tourMatch[1]} />
      </Suspense>
    );
  }

  if (path === '/') {
    return <LandingPage />;
  }

  if (path === '/competition') {
    return (
      <Suspense fallback={null}>
        <CompetitionPage />
      </Suspense>
    );
  }

  if (path === '/submit') {
    return (
      <Suspense fallback={null}>
        <SubmitArtPage />
      </Suspense>
    );
  }

  if (path === '/profile') {
    return (
      <Suspense fallback={null}>
        <ProfilePage />
      </Suspense>
    );
  }

  if (path === '/admin') {
    return (
      <Suspense fallback={null}>
        <AdminPage />
      </Suspense>
    );
  }

  return (
    <main>
      <h1>Virtual Gallery</h1>
      <p>Repository bootstrap — no application UI yet (milestone M0.3).</p>
    </main>
  );
}
