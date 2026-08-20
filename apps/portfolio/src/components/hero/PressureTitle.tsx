import { useEffect, useRef } from 'react';
import styles from './PressureTitle.module.css';

const TEXT = 'Seismic Museum';
const characters = TEXT.split('');

// Per-character variable-font axis range. wght/wdth are real Roboto Flex
// axes (see global.css's @font-face); "italic" is produced with CSS
// synthetic oblique rather than a second italic font file -- see the
// module CSS for why. Base = resting state (cursor far away or absent);
// peak = directly under the cursor.
const WGHT_BASE = 420;
const WGHT_PEAK = 880;
const WDTH_BASE = 100;
const WDTH_PEAK = 122;
const TILT_BASE = 0;
const TILT_PEAK = 9;

// Cursor influence radius in px -- beyond this a character sits at rest.
const INFLUENCE_RADIUS = 220;

// Same damped-follow shape used by the hero stone (SeismicStoneVideo):
// frame-rate-independent exponential approach, epsilon-gated so the RAF
// loop stops running once every character has settled instead of ticking
// forever in the background.
const FOLLOW_RATE = 0.22;
const SETTLE_EPSILON = 0.002;

interface CharState {
  el: HTMLSpanElement;
  centerX: number;
  centerY: number;
  current: number; // 0..1 influence, damped
  target: number; // 0..1 influence, raw
}

export interface PressureTitleProps {
  /** True once the page's entrance choreography has settled, so the title fades/rises in alongside it. */
  revealed?: boolean;
}

/**
 * "Seismic Museum" landing-page title: a from-scratch adaptation of the
 * TextPressure mouse-distance effect (weight/width/italic-lean respond to
 * cursor proximity per character), built on Roboto Flex's real wght/wdth
 * variable-font axes and this project's existing damped-RAF pattern
 * (see SeismicStoneVideo) rather than a ported implementation. Renders a
 * real "Seismic Museum" accessible name via aria-label; the per-letter
 * spans are decorative (aria-hidden).
 */
export function PressureTitle({ revealed = false }: PressureTitleProps) {
  const containerRef = useRef<HTMLHeadingElement>(null);
  const charsRef = useRef<CharState[]>([]);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const lastTsRef = useRef<number | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      return;
    }

    const spans = Array.from(container.querySelectorAll<HTMLSpanElement>('[data-char]'));
    charsRef.current = spans.map((el) => ({ el, centerX: 0, centerY: 0, current: 0, target: 0 }));

    const measure = () => {
      for (const c of charsRef.current) {
        const rect = c.el.getBoundingClientRect();
        c.centerX = rect.left + rect.width / 2;
        c.centerY = rect.top + rect.height / 2;
      }
    };
    measure();

    const applyStyle = (c: CharState) => {
      const t = c.current;
      const wght = Math.round(WGHT_BASE + (WGHT_PEAK - WGHT_BASE) * t);
      const wdth = Math.round(WDTH_BASE + (WDTH_PEAK - WDTH_BASE) * t);
      const tilt = (TILT_BASE + (TILT_PEAK - TILT_BASE) * t).toFixed(2);
      c.el.style.fontVariationSettings = `'wght' ${String(wght)}, 'wdth' ${String(wdth)}`;
      c.el.style.fontStyle = t > 0.02 ? `oblique ${tilt}deg` : 'normal';
    };

    const settled = () => charsRef.current.every((c) => c.current === c.target);

    const tick = (ts: number) => {
      const dt = lastTsRef.current === null ? 1 / 60 : (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      const factor = 1 - Math.pow(1 - FOLLOW_RATE, dt * 60);

      const pointer = pointerRef.current;
      for (const c of charsRef.current) {
        if (pointer) {
          const dx = pointer.x - c.centerX;
          const dy = pointer.y - c.centerY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          c.target = Math.max(0, 1 - dist / INFLUENCE_RADIUS);
        } else {
          c.target = 0;
        }
        c.current += (c.target - c.current) * factor;
        if (Math.abs(c.target - c.current) < SETTLE_EPSILON) {
          c.current = c.target;
        }
        applyStyle(c);
      }

      if (!settled()) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
        lastTsRef.current = null;
      }
    };

    const wake = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') return; // touch: no hover concept, leave static
      pointerRef.current = { x: event.clientX, y: event.clientY };
      wake();
    };
    const handlePointerLeave = () => {
      pointerRef.current = null;
      wake();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('resize', measure);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('resize', measure);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <h1
      className={`${styles['title'] ?? ''} ${revealed ? (styles['revealed'] ?? '') : ''}`}
      aria-label={TEXT}
      ref={containerRef}
    >
      {characters.map((char, index) => (
        <span key={index} data-char className={styles['char']} aria-hidden="true">
          {char === ' ' ? ' ' : char}
        </span>
      ))}
    </h1>
  );
}
