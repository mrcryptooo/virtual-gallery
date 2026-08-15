import { SeismicStoneVideo } from '@/components/hero/SeismicStoneVideo';
import styles from './HeroDevPage.module.css';

/**
 * Isolated dev harness for the Seismic Stone hero. The real production
 * surface is the landing route (`/`, see LandingPage.tsx), which renders the
 * same SeismicStoneVideo component. Excluded from production by the DEV
 * gate in App, same as DevTokensPage.
 */
export function HeroDevPage() {
  return (
    <main className={styles['page']}>
      <p className={styles['note']}>
        /dev/hero — Seismic Stone (video). Move the pointer over the stone to scrub it open; move
        away to let it settle closed. Click/tap or press Enter/Space to enter the museum.
        Reduced-motion and keyboard activation both work.
      </p>
      <div className={styles['stage']}>
        <SeismicStoneVideo interactive />
      </div>
    </main>
  );
}
