import styles from './Scrim.module.css';

export interface ScrimProps {
  /** Pointer supplement for closing the overlay above this scrim. */
  onDismiss?: () => void;
}

/**
 * Overlay backdrop (doc 11 §2): owns click-to-close. The scrim is a pointer
 * convenience only — the keyboard path (Escape, focus trap) is owned by the
 * dialog rendered above it (doc 09 §2), so this element is not focusable.
 */
export function Scrim({ onDismiss }: ScrimProps) {
  return <div className={styles['scrim']} aria-hidden="true" onClick={onDismiss} />;
}
