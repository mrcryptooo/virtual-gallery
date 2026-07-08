import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant per doc 11 §2: primary (ink fill), ghost (hairline), quiet (text). */
  variant?: 'primary' | 'ghost' | 'quiet';
  /** Loading state: label swaps for an inline spinner, width preserved (doc 11 §3). */
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      className={[styles['button'], styles[variant], className].filter(Boolean).join(' ')}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      data-loading={loading || undefined}
      {...rest}
    >
      <span className={styles['label']}>{children}</span>
      {loading && <span className={styles['spinner']} aria-hidden="true" />}
    </button>
  );
}
