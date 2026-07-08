import type { ReactNode } from 'react';
import styles from './Toast.module.css';

/**
 * Toast primitive (doc 11 §2): polite live region, bottom-center placement.
 * Presentational only — the 4 s timing / max-2 stacking manager arrives with
 * the first product feature that raises toasts (ShareSheet, Phase 3).
 */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div role="status" className={styles['toast']}>
      {children}
    </div>
  );
}
