import { lazy, Suspense } from 'react';
import { DevTokensPage } from './DevTokensPage';

// Lazy: the tour page pulls the engine (PSV + three) — it must stay out of
// the shell chunk (doc 08 §4). Visitors who never open a tour never load it.
const TourPage = lazy(() => import('./TourPage').then((module) => ({ default: module.TourPage })));

/**
 * Route handling is deliberately minimal until M1.6 (react-router + deep
 * links + URL view sync). Recognized today:
 *   /p/<project-slug>   → walkthrough (integration test)
 *   /dev/tokens         → design-system showcase (dev builds only)
 */
export function App() {
  const path = window.location.pathname;

  if (import.meta.env.DEV && path === '/dev/tokens') {
    return <DevTokensPage />;
  }

  const tourMatch = /^\/p\/([a-z0-9-]+)\/?$/.exec(path);
  if (tourMatch?.[1] !== undefined) {
    return (
      <Suspense fallback={null}>
        <TourPage projectSlug={tourMatch[1]} />
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
