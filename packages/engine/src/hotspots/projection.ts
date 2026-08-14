/**
 * Hotspot projection math (doc 02 §2.4, doc 03: "projection math — no DOM").
 *
 * Pure and framework-free so it can be unit-tested headlessly and reused by
 * clients that need to place off-screen indicators. ViewerCore uses these
 * helpers for bearings; exact on-screen pixel positions still come from the
 * viewer's own camera.
 */

/** Wrap an angle in degrees to (-180, 180]. */
export function wrap180(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d <= -180) d += 360;
  return d;
}

export interface Bearing {
  /** Signed yaw offset from the view direction, wrapped to ±180. */
  readonly deltaYaw: number;
  /** Signed pitch offset from the view direction. */
  readonly deltaPitch: number;
  /** Screen-space direction from the viewport centre: 0 = right, 90 = down. */
  readonly angleDeg: number;
}

/** Bearing from a view direction to a hotspot direction, all in degrees. */
export function bearing(
  viewYaw: number,
  viewPitch: number,
  hotspotYaw: number,
  hotspotPitch: number,
): Bearing {
  const deltaYaw = wrap180(hotspotYaw - viewYaw);
  const deltaPitch = hotspotPitch - viewPitch;
  // +y is down on screen, so a hotspot above the centre yields a negative y.
  // Wrapped so a due-left bearing is always +180, never atan2's -180.
  const angleDeg = wrap180((Math.atan2(-deltaPitch, deltaYaw) / Math.PI) * 180);
  return { deltaYaw, deltaPitch, angleDeg };
}

/**
 * Horizontal field of view for a vertical FOV and viewport aspect ratio.
 * Portrait viewports have a much narrower horizontal FOV, which is why
 * hotspots that are comfortably visible on a desktop fall off-screen on a
 * phone held upright.
 */
export function horizontalFov(verticalFovDeg: number, aspect: number): number {
  const halfV = ((verticalFovDeg / 2) * Math.PI) / 180;
  return ((2 * Math.atan(Math.tan(halfV) * aspect)) / Math.PI) * 180;
}

/**
 * Analytic visibility model for a pinhole camera. Used for preflight checks
 * and tests; the runtime defers to the viewer's own projection.
 */
export function isOnScreen(
  b: Pick<Bearing, 'deltaYaw' | 'deltaPitch'>,
  verticalFovDeg: number,
  aspect: number,
): boolean {
  if (Math.abs(b.deltaYaw) >= 89) return false;
  const hFov = horizontalFov(verticalFovDeg, aspect);
  return Math.abs(b.deltaYaw) < hFov / 2 && Math.abs(b.deltaPitch) < verticalFovDeg / 2;
}

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/**
 * Clamp a bearing to the boundary of a rectangle, measured from its centre —
 * where an off-screen indicator sits. The rectangle is supplied by the client
 * (it owns chrome and safe-area insets), so this stays a pure calculation.
 */
export function clampToRect(rect: Rect, angleDeg: number): Point {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const hx = rect.width / 2;
  const hy = rect.height / 2;
  if (hx <= 0 || hy <= 0) return { x: cx, y: cy };

  const a = (angleDeg * Math.PI) / 180;
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  // Distance along the ray to each pair of edges; the nearer one is the hit.
  const tx = Math.abs(dx) < 1e-6 ? Infinity : hx / Math.abs(dx);
  const ty = Math.abs(dy) < 1e-6 ? Infinity : hy / Math.abs(dy);
  const t = Math.min(tx, ty);
  return { x: cx + dx * t, y: cy + dy * t };
}

/** Plain-language direction for an accessible label (doc 09 §2). */
export function directionWord(deltaYaw: number, deltaPitch: number): string {
  if (Math.abs(deltaYaw) > 135) return 'behind you';
  if (deltaYaw < -20) return 'to your left';
  if (deltaYaw > 20) return 'to your right';
  return deltaPitch >= 0 ? 'above you' : 'below you';
}
