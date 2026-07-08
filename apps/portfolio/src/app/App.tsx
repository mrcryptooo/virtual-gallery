import { DevTokensPage } from './DevTokensPage';

/**
 * Bootstrap placeholder (M0.0). Product UI begins with the frozen design
 * system (docs/11); routing proper arrives at M1.6.
 *
 * /dev/tokens is the internal design-system showcase (M0.3) — dev builds
 * only; the DEV gate dead-code-eliminates it from production.
 */
export function App() {
  if (import.meta.env.DEV && window.location.pathname === '/dev/tokens') {
    return <DevTokensPage />;
  }

  return (
    <main>
      <h1>Virtual Gallery</h1>
      <p>Repository bootstrap — no application UI yet (milestone M0.3).</p>
    </main>
  );
}
