import { lazy, Suspense } from 'react';
import { CompetitionPage } from './CompetitionPage';
import { DevTokensPage } from './DevTokensPage';
import { HeroDevPage } from './HeroDevPage';
import { LandingPage } from './LandingPage';
import { SubmitArtPage } from './SubmitArtPage';

// Lazy: the tour page pulls the engine (PSV + three) — it must stay out of
// the shell chunk (doc 08 §4). Visitors who never open a tour never load it.
const TourPage = lazy(() => import('./TourPage').then((module) => ({ default: module.TourPage })));

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
    return <CompetitionPage />;
  }

  if (path === '/submit') {
    return <SubmitArtPage />;
  }

  return (
    <main>
      <h1>Virtual Gallery</h1>
      <p>Repository bootstrap — no application UI yet (milestone M0.3).</p>
    </main>
  );
}
