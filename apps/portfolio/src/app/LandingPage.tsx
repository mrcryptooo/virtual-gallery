import { useCallback, useEffect, useState } from 'react';
import { PressureTitle } from '@/components/hero/PressureTitle';
import { SeismicStoneVideo } from '@/components/hero/SeismicStoneVideo';
import { SoundToggle } from '@/components/hero/SoundToggle';
import { SiteHeader } from '@/components/nav/SiteHeader';
import styles from './LandingPage.module.css';

const MUSEUM_HREF = '/p/modern-museum';
const SOUND_PREFERENCE_KEY = 'seismic-museum:sound-enabled';

// Total entrance choreography length: stone resolve (0ms, 600ms duration) ->
// wordmark (200ms) -> tagline (450ms, 600ms duration) -> CTA (750ms, 600ms
// duration) settles by 1350ms. Matches the transition-delay values in
// LandingPage.module.css, all composed from tokens.css motion tokens.
const ENTRANCE_SETTLE_MS = 1400;

function readStoredSoundPreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const stored = window.localStorage.getItem(SOUND_PREFERENCE_KEY);
    // Default ON: the owner's explicit requirement is that opening the
    // stone produces sound: mute is an opt-out, not an opt-in.
    return stored === null ? true : stored === '1';
  } catch {
    // Storage can throw in locked-down/private-browsing contexts -- default
    // to the same "sound on" behavior rather than failing the page.
    return true;
  }
}

/**
 * Public landing page (`/`) — a single full-viewport museum entrance. The
 * Seismic Stone reference video (see components/hero/SeismicStoneVideo) IS
 * the viewport's visual field: a fixed, full-bleed, object-fit: cover layer,
 * not a rectangle sitting on a separate page background. Overlay UI
 * (nav, tagline, CTA) floats above it; there is no other background layer
 * to seam-match, since cover always fully covers the viewport.
 */
export function LandingPage() {
  const [entranceReady, setEntranceReady] = useState(false);
  const [interactive, setInteractive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(readStoredSoundPreference);

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

  const handleSoundToggle = useCallback((next: boolean) => {
    setSoundEnabled(next);
    try {
      window.localStorage.setItem(SOUND_PREFERENCE_KEY, next ? '1' : '0');
    } catch {
      // Best-effort persistence only -- the in-memory state still works for
      // the rest of this session even if storage is unavailable.
    }
  }, []);

  return (
    <div
      className={`${styles['page'] ?? ''} ${entranceReady ? (styles['entranceReady'] ?? '') : ''}`}
    >
      <div className={styles['field']} aria-hidden="true" />
      <SeismicStoneVideo
        href={MUSEUM_HREF}
        interactive={interactive}
        revealed={entranceReady}
        soundEnabled={soundEnabled}
      />

      <SiteHeader
        revealed={entranceReady}
        trailing={<SoundToggle enabled={soundEnabled} onToggle={handleSoundToggle} />}
      />

      <main className={styles['stage']}>
        <div className={styles['identity']}>
          <PressureTitle revealed={entranceReady} />
          <p className={styles['subtitle']}>
            <span
              className={`${styles['subtitleLead'] ?? ''} ${entranceReady ? (styles['subtitleRevealed'] ?? '') : ''}`}
            >
              Private Patronage. Public Art.
            </span>
            <span
              className={`${styles['subtitleBody'] ?? ''} ${entranceReady ? (styles['subtitleRevealed'] ?? '') : ''}`}
            >
              Experience a new era of confidential art patronage, powered by Seismic&rsquo;s native
              on-chain privacy supporting artists and collecting art without exposing your financial
              activity.
            </span>
          </p>
        </div>

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
