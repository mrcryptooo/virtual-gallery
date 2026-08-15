import { SeismicStoneFinal } from '@/components/hero/SeismicStoneFinal';
import styles from './HeroDevPage.module.css';

/**
 * Isolated dev harness for the Seismic Stone (13 primary pieces + 14
 * debris, extruded directly from the approved 2D blueprint). Kept for
 * future isolated development/review; the real production surface is the
 * landing route (`/`, see LandingPage.tsx), which lazy-loads the same
 * SeismicStoneFinal component. Excluded from production by the DEV gate
 * in App, same as DevTokensPage.
 */
export function HeroDevPage() {
  return (
    <main className={styles['page']}>
      <p className={styles['note']}>
        /dev/hero — Seismic Stone (final). Hover to fracture, click/tap to enter the museum.
        Reduced-motion and keyboard activation both work.
      </p>
      <div className={styles['stage']}>
        <SeismicStoneFinal />
      </div>
    </main>
  );
}
