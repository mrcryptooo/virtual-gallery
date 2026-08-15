import { SeismicStoneFinal } from '@/components/hero/SeismicStoneFinal';
import styles from './HeroDevPage.module.css';

/**
 * Owner visual-review harness for the Seismic Stone (final -- 13 primary
 * pieces + 14 debris, extruded directly from the approved 2D blueprint
 * traced from the reference video/images). Not a product surface --
 * excluded from production by the DEV gate in App, same as DevTokensPage.
 *
 * Unlike the earlier prototypes, clicking here DOES navigate to
 * /p/modern-museum -- this is the production interaction, reviewed here
 * before being wired into the real landing page.
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
