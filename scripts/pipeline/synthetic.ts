/**
 * Synthetic equirect master (doc 12 M0.5): a procedurally generated pattern
 * that makes seams, orientation, and pole errors obvious — programmatically
 * and to the eye:
 *
 *  - continuous base gradient (wraps at yaw ±180 by construction),
 *  - white gridlines every 10°, dense at the poles (aliasing stress),
 *  - cardinal markers: red @ yaw 0, green @ +90, blue @ ±180, yellow @ −90
 *    (equator, ±1.5° squares), white band at the north pole, black at south.
 */

export const MARKERS = {
  front: [255, 0, 0],
  right: [0, 200, 0],
  back: [0, 64, 255],
  left: [255, 220, 0],
  up: [255, 255, 255],
  down: [0, 0, 0],
} as const;

export interface RawImage {
  readonly data: Uint8Array; // RGB, 3 channels
  readonly width: number;
  readonly height: number;
}

/** Color of the pattern at a given direction (also used by tests as ground truth). */
export function syntheticColorAt(yawDeg: number, pitchDeg: number): [number, number, number] {
  // Pole bands (kill yaw-dependence at the singularities)
  if (pitchDeg > 88) return [MARKERS.up[0], MARKERS.up[1], MARKERS.up[2]];
  if (pitchDeg < -88) return [MARKERS.down[0], MARKERS.down[1], MARKERS.down[2]];

  // Cardinal marker squares on the equator, ±1.5°
  const near = (a: number, b: number) => {
    let d = Math.abs(a - b) % 360;
    if (d > 180) d = 360 - d;
    return d <= 1.5;
  };
  if (Math.abs(pitchDeg) <= 1.5) {
    if (near(yawDeg, 0)) return [MARKERS.front[0], MARKERS.front[1], MARKERS.front[2]];
    if (near(yawDeg, 90)) return [MARKERS.right[0], MARKERS.right[1], MARKERS.right[2]];
    if (near(yawDeg, 180)) return [MARKERS.back[0], MARKERS.back[1], MARKERS.back[2]];
    if (near(yawDeg, -90)) return [MARKERS.left[0], MARKERS.left[1], MARKERS.left[2]];
  }

  // Gridlines every 10° (0.15° half-width)
  const frac = (x: number) => {
    const f = x % 10;
    return Math.min(Math.abs(f), 10 - Math.abs(f));
  };
  if (frac(yawDeg) < 0.15 || frac(pitchDeg) < 0.15) return [255, 255, 255];

  // Continuous base gradient (wraps in yaw, ramps in pitch)
  const yawRad = (yawDeg * Math.PI) / 180;
  const r = Math.round(128 + 80 * Math.cos(yawRad));
  const b = Math.round(128 + 80 * Math.sin(yawRad));
  const g = Math.round(((90 - pitchDeg) / 180) * 220);
  return [r, g, b];
}

export function generateSyntheticEquirect(width: number): RawImage {
  const height = width / 2;
  const data = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y++) {
    const pitch = 90 - ((y + 0.5) / height) * 180;
    for (let x = 0; x < width; x++) {
      const yaw = ((x + 0.5) / width) * 360 - 180;
      const [r, g, b] = syntheticColorAt(yaw, pitch);
      const o = (y * width + x) * 3;
      data[o] = r;
      data[o + 1] = g;
      data[o + 2] = b;
    }
  }
  return { data, width, height };
}
