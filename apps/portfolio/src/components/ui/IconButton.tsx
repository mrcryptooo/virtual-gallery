import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './IconButton.module.css';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'aria-label' | 'children'
> {
  /** Required accessible name (doc 11 §2: "always aria-label"). */
  label: string;
  /** Icon node; rendered aria-hidden — the label carries the semantics. */
  children: ReactNode;
}

export function IconButton({ label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={[styles['iconButton'], className].filter(Boolean).join(' ')}
      {...rest}
    >
      <span aria-hidden="true" className={styles['icon']}>
        {children}
      </span>
    </button>
  );
}
