import { useEffect, useRef, useState } from 'react';
import { clampToRect, directionWord, type ProjectedHotspot } from '@virtual-gallery/engine';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import styles from './HotspotLayer.module.css';

export interface HotspotLayerProps {
  hotspots: readonly ProjectedHotspot[];
  onNavigate: (projected: ProjectedHotspot) => void;
  onInfo: (projected: ProjectedHotspot) => void;
  /** Turn the view toward an off-screen hotspot instead of jumping to it. */
  onOrient: (projected: ProjectedHotspot) => void;
}

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const EMPTY_RECT: Rect = { left: 0, top: 0, width: 0, height: 0 };

/**
 * DOM hotspot layer (doc 02 §2.4): real <button>s positioned by the engine's
 * projection events — natively focusable and screen-reader labeled (doc 09).
 *
 * Navigation hotspots that fall outside the viewport are not dropped: they
 * render as edge-clamped indicators pointing toward the destination, so every
 * scene keeps a discoverable way onward at any viewport aspect — portrait
 * phones included, where the horizontal field of view is far narrower.
 * v1 renders navigation + information; reserved hotspot types are not rendered.
 */
export function HotspotLayer({ hotspots, onNavigate, onInfo, onOrient }: HotspotLayerProps) {
  const safeRef = useRef<HTMLDivElement>(null);
  const [safeRect, setSafeRect] = useState<Rect>(EMPTY_RECT);

  // The clamp rectangle comes from CSS (chrome + safe-area insets), measured
  // on resize/orientation change rather than recomputed per frame.
  useEffect(() => {
    const element = safeRef.current;
    if (element === null) return;
    const measure = () => {
      const layer = element.offsetParent as HTMLElement | null;
      const box = element.getBoundingClientRect();
      const origin = layer?.getBoundingClientRect();
      setSafeRect({
        left: box.left - (origin?.left ?? 0),
        top: box.top - (origin?.top ?? 0),
        width: box.width,
        height: box.height,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener('orientationchange', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  return (
    <div className={styles['layer']}>
      <div ref={safeRef} className={styles['safeRect']} aria-hidden="true" />

      {hotspots.map((projected) => {
        const { hotspot, x, y, onScreen, angleDeg, deltaYaw, deltaPitch } = projected;
        if (hotspot.type !== 'navigation' && hotspot.type !== 'information') return null;
        const key = `${hotspot.type}-${String(hotspot.yaw)}-${String(hotspot.pitch)}`;
        const isInfo = hotspot.type === 'information';

        if (onScreen) {
          const className = [styles['hotspot'], isInfo ? styles['info'] : undefined]
            .filter(Boolean)
            .join(' ');
          return (
            <button
              key={key}
              type="button"
              className={className}
              style={{ left: `${String(x)}px`, top: `${String(y)}px` }}
              onClick={() => {
                if (isInfo) {
                  onInfo(projected);
                } else {
                  onNavigate(projected);
                }
              }}
            >
              <span className={styles['core']} aria-hidden="true">
                {isInfo ? '+' : ''}
              </span>
              <span className={styles['label']} aria-hidden="true">
                {hotspot.label}
              </span>
              <VisuallyHidden>{hotspot.label}</VisuallyHidden>
            </button>
          );
        }

        // Off-screen: only navigation keeps an indicator — information points
        // would clutter the edges without aiding wayfinding.
        if (isInfo || safeRect.width === 0) return null;
        const point = clampToRect(safeRect, angleDeg);
        return (
          <button
            key={key}
            type="button"
            data-edge-indicator="true"
            className={styles['edge']}
            style={{ left: `${String(point.x)}px`, top: `${String(point.y)}px` }}
            onClick={() => {
              onOrient(projected);
            }}
          >
            <span
              className={styles['arrow']}
              // The chevron's borders point up-right, i.e. 45° ahead of the bearing
              style={{ transform: `rotate(${String(angleDeg + 45)}deg)` }}
              aria-hidden="true"
            />
            <VisuallyHidden>
              {`${hotspot.label} — ${directionWord(deltaYaw, deltaPitch)}. Turn to view.`}
            </VisuallyHidden>
          </button>
        );
      })}
    </div>
  );
}
