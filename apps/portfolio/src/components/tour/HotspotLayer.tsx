import type { ProjectedHotspot } from '@virtual-gallery/engine';
import { VisuallyHidden } from '@/components/ui/VisuallyHidden';
import styles from './HotspotLayer.module.css';

export interface HotspotLayerProps {
  hotspots: readonly ProjectedHotspot[];
  onNavigate: (projected: ProjectedHotspot) => void;
  onInfo: (projected: ProjectedHotspot) => void;
}

/**
 * DOM hotspot layer (doc 02 §2.4): real <button>s positioned by the engine's
 * projection events — natively focusable and screen-reader labeled (doc 09).
 * v1 renders navigation + information; reserved types are not rendered.
 */
export function HotspotLayer({ hotspots, onNavigate, onInfo }: HotspotLayerProps) {
  return (
    <div className={styles.layer}>
      {hotspots.map((projected) => {
        const { hotspot, x, y, visible } = projected;
        if (!visible) return null;
        if (hotspot.type !== 'navigation' && hotspot.type !== 'information') return null;
        const isInfo = hotspot.type === 'information';
        const className = [styles['hotspot'], isInfo ? styles['info'] : undefined]
          .filter(Boolean)
          .join(' ');
        return (
          <button
            key={`${hotspot.type}-${String(hotspot.yaw)}-${String(hotspot.pitch)}`}
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
            <span className={styles.core} aria-hidden="true">
              {isInfo ? '+' : ''}
            </span>
            <span className={styles.label} aria-hidden="true">
              {hotspot.label}
            </span>
            <VisuallyHidden>{hotspot.label}</VisuallyHidden>
          </button>
        );
      })}
    </div>
  );
}
