import { SiteHeader } from '@/components/nav/SiteHeader';
import styles from './CompetitionPage.module.css';

/**
 * `/competition` — architecture is intentionally already in the shape a
 * future listing needs (see src/lib/community/types.ts CompetitionRecord),
 * but this phase ships no real competitions yet: no invented dates,
 * prizes, or sponsors. Just an honest, premium "coming soon" state.
 */
export function CompetitionPage() {
  return (
    <div className={styles['page']}>
      <SiteHeader />
      <main className={styles['stage']}>
        <p className={styles['eyebrow']}>Seismic Museum</p>
        <h1 className={styles['title']}>Competitions</h1>
        <p className={styles['body']}>
          New creative challenges are coming soon — official Seismic Museum competitions and
          challenges proposed by the community itself, each with its own place in the museum.
        </p>
        <p className={styles['note']}>Check back for the first open call.</p>
        <a className={styles['back']} href="/">
          &larr; Back to the entrance
        </a>
      </main>
    </div>
  );
}
