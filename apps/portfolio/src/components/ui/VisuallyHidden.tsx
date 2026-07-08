import type { ReactNode } from 'react';
import styles from './VisuallyHidden.module.css';

/** Screen-reader-only content (doc 09 §2: viewer descriptions, extra context). */
export function VisuallyHidden({ children }: { children: ReactNode }) {
  return <span className={styles['visuallyHidden']}>{children}</span>;
}
