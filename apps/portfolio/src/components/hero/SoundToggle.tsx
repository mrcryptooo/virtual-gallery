import { useCallback } from 'react';
import styles from './SoundToggle.module.css';

export interface SoundToggleProps {
  enabled: boolean;
  onToggle: (next: boolean) => void;
}

/**
 * Minimal speaker/mute icon control. Purely presentational + a click
 * handler -- the actual audio-unlock gesture and playback state live in
 * SeismicStoneVideo, which also treats a click here as the "first genuine
 * interaction" that's allowed to unlock audio under autoplay policy.
 */
export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  const handleClick = useCallback(() => {
    onToggle(!enabled);
  }, [enabled, onToggle]);

  return (
    <button
      type="button"
      className={styles['toggle']}
      aria-label={enabled ? 'Mute sound' : 'Unmute sound'}
      aria-pressed={enabled}
      onClick={handleClick}
    >
      {enabled ? (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
          <path
            d="M16.5 8.5a5 5 0 0 1 0 7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M19 6a9 9 0 0 1 0 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
            opacity="0.6"
          />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M4 9v6h4l5 4V5L8 9H4Z" fill="currentColor" />
          <path
            d="M16 9.5l4.5 5m0-5-4.5 5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}
