import type { Wayfinding } from '@virtual-gallery/engine';
import styles from './TourChrome.module.css';

export interface TourChromeProps {
  projectTitle: string;
  panoramaTitle: string;
  wayfinding: Wayfinding | undefined;
}

/**
 * Minimal tour chrome for the integration test (doc 11 TourChrome subset):
 * project title, wayfinding line, panorama name on the top scrim-edge, and a
 * gesture hint at the bottom. Auto-hide + control cluster arrive in Phase 3.
 */
export function TourChrome({ projectTitle, panoramaTitle, wayfinding }: TourChromeProps) {
  const location = wayfinding
    ? [wayfinding.building, wayfinding.floor, wayfinding.room].filter(Boolean).join(' · ')
    : '';
  return (
    <>
      <header className={styles.top}>
        <span className={styles.project}>{projectTitle}</span>
        {location !== '' && <span className={styles.wayfinding}>{location}</span>}
        <h1 className={styles.scene}>{panoramaTitle}</h1>
      </header>
      <p className={styles.hint} aria-hidden="true">
        Drag or use arrow keys to look around · Click the circles to move
      </p>
    </>
  );
}
