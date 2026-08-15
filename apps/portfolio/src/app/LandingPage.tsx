import { lazy, Suspense } from 'react';
import styles from './LandingPage.module.css';

// Lazy: isolates the Hero's direct-three payload into its own chunk, kept
// out of both the shell chunk and the TourPage/engine chunk (doc 08 §4).
const SeismicStoneFinal = lazy(() =>
  import('@/components/hero/SeismicStoneFinal').then((module) => ({
    default: module.SeismicStoneFinal,
  })),
);

/**
 * Public landing page (`/`). Intentionally minimal for now: a plain
 * background layer, the transparent Seismic Stone hero centered above it,
 * and nothing else -- typography, motion, and further sections come later.
 *
 * Layering (bottom to top): background layer -> transparent stone layer ->
 * future content/UI layer. The stone never paints its own background.
 */
export function LandingPage() {
  return (
    <div className={styles['page']}>
      <div className={styles['background']} aria-hidden="true" />
      <div className={styles['stoneLayer']}>
        <Suspense fallback={<div className={styles['stonePlaceholder']} aria-hidden="true" />}>
          <SeismicStoneFinal />
        </Suspense>
      </div>
    </div>
  );
}
