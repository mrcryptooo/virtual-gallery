import { describe, expect, it } from 'vitest';
import {
  bearing,
  clampToRect,
  directionWord,
  horizontalFov,
  isOnScreen,
  wrap180,
} from './projection.ts';

describe('wrap180', () => {
  it.each([
    [0, 0],
    [180, 180],
    [181, -179],
    [-181, 179],
    [360, 0],
    [540, 180],
    [-540, 180],
  ])('wraps %s to %s', (input, expected) => {
    expect(wrap180(input)).toBeCloseTo(expected, 6);
  });
});

describe('bearing', () => {
  it('points right when the hotspot is clockwise of the view', () => {
    const b = bearing(0, 0, 40, 0);
    expect(b.deltaYaw).toBe(40);
    expect(b.angleDeg).toBeCloseTo(0); // 0° = screen right
  });

  it('points left when the hotspot is anticlockwise', () => {
    expect(bearing(0, 0, -40, 0).angleDeg).toBeCloseTo(180);
  });

  it('points up for a hotspot above the view (screen y grows downward)', () => {
    expect(bearing(0, 0, 0, 30).angleDeg).toBeCloseTo(-90);
  });

  it('points down for a hotspot below the view', () => {
    expect(bearing(0, 0, 0, -30).angleDeg).toBeCloseTo(90);
  });

  it('takes the short way around the seam', () => {
    expect(bearing(170, 0, -170, 0).deltaYaw).toBe(20);
    expect(bearing(-170, 0, 170, 0).deltaYaw).toBe(-20);
  });
});

describe('horizontalFov', () => {
  it('is wider than the vertical FOV in landscape and narrower in portrait', () => {
    const landscape = horizontalFov(90, 1366 / 768);
    const portrait = horizontalFov(90, 390 / 844);
    expect(landscape).toBeGreaterThan(90);
    expect(portrait).toBeLessThan(90);
    // The regression this whole feature exists for: a phone held upright sees
    // barely half the horizontal sweep a desktop does.
    expect(portrait).toBeLessThan(landscape / 1.8);
  });
});

describe('isOnScreen', () => {
  const portrait = 390 / 844;
  const landscape = 1366 / 768;

  it('accepts a 40° hotspot in landscape but rejects it in portrait', () => {
    const b = bearing(0, 0, 40, 0);
    expect(isOnScreen(b, 90, landscape)).toBe(true);
    expect(isOnScreen(b, 90, portrait)).toBe(false);
  });

  it('always rejects directions behind the camera', () => {
    expect(isOnScreen(bearing(0, 0, 175, 0), 90, landscape)).toBe(false);
  });
});

describe('clampToRect', () => {
  const rect = { left: 20, top: 40, width: 200, height: 100 };
  const cx = 120;
  const cy = 90;

  it('puts a rightward bearing on the right edge, vertically centred', () => {
    const p = clampToRect(rect, 0);
    expect(p.x).toBeCloseTo(rect.left + rect.width);
    expect(p.y).toBeCloseTo(cy);
  });

  it('puts a downward bearing on the bottom edge', () => {
    const p = clampToRect(rect, 90);
    expect(p.x).toBeCloseTo(cx);
    expect(p.y).toBeCloseTo(rect.top + rect.height);
  });

  it('puts a leftward bearing on the left edge', () => {
    expect(clampToRect(rect, 180).x).toBeCloseTo(rect.left);
  });

  it('keeps every bearing inside the rectangle bounds', () => {
    for (let angle = -180; angle <= 180; angle += 7) {
      const p = clampToRect(rect, angle);
      expect(p.x).toBeGreaterThanOrEqual(rect.left - 0.001);
      expect(p.x).toBeLessThanOrEqual(rect.left + rect.width + 0.001);
      expect(p.y).toBeGreaterThanOrEqual(rect.top - 0.001);
      expect(p.y).toBeLessThanOrEqual(rect.top + rect.height + 0.001);
    }
  });

  it('degrades safely for an empty rectangle', () => {
    const p = clampToRect({ left: 0, top: 0, width: 0, height: 0 }, 45);
    expect(Number.isFinite(p.x)).toBe(true);
    expect(Number.isFinite(p.y)).toBe(true);
  });
});

describe('directionWord', () => {
  it.each([
    [-90, 0, 'to your left'],
    [90, 0, 'to your right'],
    [175, 0, 'behind you'],
    [-175, 0, 'behind you'],
    [0, 30, 'above you'],
    [0, -30, 'below you'],
  ])('describes Δyaw %s / Δpitch %s as "%s"', (dYaw, dPitch, expected) => {
    expect(directionWord(dYaw, dPitch)).toBe(expected);
  });
});
