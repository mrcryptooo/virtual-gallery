import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Raised panels (dialogs, sheets) sit on --color-surface-raised with overlay shadow. */
  raised?: boolean;
  children: ReactNode;
}

/** Surface container (doc 11 §1/§2): hairline-bordered card or raised overlay surface. */
export function Panel({ raised = false, className, children, ...rest }: PanelProps) {
  return (
    <div
      className={[styles['panel'], raised ? styles['raised'] : '', className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
