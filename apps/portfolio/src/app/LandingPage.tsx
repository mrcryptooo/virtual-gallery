import { useEffect, useState } from 'react';
import { SeismicStoneVideo } from '@/components/hero/SeismicStoneVideo';
import styles from './LandingPage.module.css';

const MUSEUM_HREF = '/p/modern-museum';
// Sampled from the reference stone video's plate faces (mirrors
// --color-stone-body in tokens.css) — shown as museum/catalog metadata,
// not a debug value.
const STONE_HEX = '#51343B';

// Total entrance choreography length: stone resolve (0ms) -> wordmark (200ms)
// -> metadata (400ms) -> tagline (600ms, 600ms duration) -> CTA (900ms, 300ms
// duration) settles by ~1200ms. Matches the transition-delay values in
// LandingPage.module.css, all composed from tokens.css motion tokens.
const ENTRANCE_SETTLE_MS = 1250;

/**
 * Public landing page (`/`) — a single full-viewport museum entrance. The
 * Seismic Stone hero is the reference video itself (see
 * components/hero/SeismicStoneVideo), pointer/touch-scrubbed between a
 * measured closed and open frame range; the page background is not a plain
 * fill but a reproduction of the video's own sampled tonal field so the
 * video box has no visible edge against it.
 */
export function LandingPage() {
  const [entranceReady, setEntranceReady] = useState(false);
  const [interactive, setInteractive] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Two rAFs: guarantees the initial (opacity: 0) styles have painted
    // before the class flips, so the CSS transition actually runs instead
    // of the browser coalescing both states into one paint. rAF is paused
    // in a backgrounded/non-composited tab, so a bounded fallback timer
    // also flips the flag -- the entrance content (including the CTA) must
    // never stay permanently invisible just because the tab wasn't
    // foregrounded on load; setEntranceReady(true) is idempotent, so
    // whichever fires first wins and the other is a harmless no-op.
    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        setEntranceReady(true);
      });
    });
    const entranceFallback = setTimeout(() => {
      setEntranceReady(true);
    }, 150);
    const interactiveTimer = setTimeout(
      () => {
        setInteractive(true);
      },
      reduced ? 0 : ENTRANCE_SETTLE_MS,
    );
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      clearTimeout(entranceFallback);
      clearTimeout(interactiveTimer);
    };
  }, []);

  return (
    <div
      className={`${styles['page'] ?? ''} ${entranceReady ? (styles['entranceReady'] ?? '') : ''}`}
    >
      <div className={styles['background']} aria-hidden="true" />

      <header className={styles['identity']}>
        <p className={styles['wordmark']}>Seismic Museum</p>
        <div className={styles['metadata']}>
          <span className={styles['swatch']} aria-hidden="true" />
          <p className={styles['metaLabel']}>Stone / {STONE_HEX}</p>
        </div>
      </header>

      <main className={styles['stage']}>
        <div className={styles['stoneWrap']}>
          <SeismicStoneVideo href={MUSEUM_HREF} interactive={interactive} />
        </div>

        <p className={styles['tagline']}>
          <span className={styles['taglineInner']}>The Community Is the Legacy</span>
        </p>

        <a className={styles['cta']} href={MUSEUM_HREF}>
          Enter the Museum
          <span className={styles['ctaArrow']} aria-hidden="true">
            &rarr;
          </span>
        </a>
      </main>
    </div>
  );
}
