/**
 * Equirect → cube-face reprojection (doc 07 §2 step 2): Lanczos3 sampling
 * with horizontal kernel scaling near the poles ("pole oversampling") —
 * where one face pixel spans many equirect pixels horizontally, the kernel
 * widens to average them instead of aliasing.
 *
 * Addressing: horizontal wrap (yaw is periodic), vertical clamp.
 */
import type { CubeFace } from '@virtual-gallery/engine';
import { directionToEquirect, faceDirection } from './geometry.ts';
import type { RawImage } from './synthetic.ts';

const LOBES = 3;
const MAX_SCALE_X = 16; // cap on pole oversampling width (perf bound)

function lanczos(x: number): number {
  if (x === 0) return 1;
  const ax = Math.abs(x);
  if (ax >= LOBES) return 0;
  const pix = Math.PI * x;
  return (LOBES * Math.sin(pix) * Math.sin(pix / LOBES)) / (pix * pix);
}

/**
 * Sample the equirect source at fractional pixel (sx, sy) with a Lanczos3
 * kernel whose horizontal support is scaled by `scaleX` (≥ 1 = minification).
 * Writes RGB into out[outOffset..outOffset+2].
 */
export function sampleLanczos3(
  src: RawImage,
  sx: number,
  sy: number,
  scaleX: number,
  out: Uint8Array,
  outOffset: number,
): void {
  const { data, width, height } = src;
  const rx = Math.ceil(LOBES * scaleX);
  const x0 = Math.floor(sx);
  const y0 = Math.floor(sy);

  let r = 0;
  let g = 0;
  let b = 0;
  let wsum = 0;

  for (let ty = y0 - LOBES + 1; ty <= y0 + LOBES; ty++) {
    const wy = lanczos(sy - ty);
    if (wy === 0) continue;
    // vertical clamp (zenith/nadir rows repeat)
    const cy = ty < 0 ? 0 : ty >= height ? height - 1 : ty;
    const rowBase = cy * width;
    for (let tx = x0 - rx + 1; tx <= x0 + rx; tx++) {
      const wx = lanczos((sx - tx) / scaleX) / scaleX;
      if (wx === 0) continue;
      // horizontal wrap (yaw is periodic)
      let cx = tx % width;
      if (cx < 0) cx += width;
      const w = wx * wy;
      const o = (rowBase + cx) * 3;
      r += w * (data[o] ?? 0);
      g += w * (data[o + 1] ?? 0);
      b += w * (data[o + 2] ?? 0);
      wsum += w;
    }
  }

  const inv = wsum !== 0 ? 1 / wsum : 0;
  out[outOffset] = Math.max(0, Math.min(255, Math.round(r * inv)));
  out[outOffset + 1] = Math.max(0, Math.min(255, Math.round(g * inv)));
  out[outOffset + 2] = Math.max(0, Math.min(255, Math.round(b * inv)));
}

/** Render one full cube face at `size`×`size` from the equirect source. */
export function reprojectFace(src: RawImage, face: CubeFace, size: number): Uint8Array {
  const out = new Uint8Array(size * size * 3);
  const { width, height } = src;

  for (let py = 0; py < size; py++) {
    const j = (py + 0.5) / size;
    for (let px = 0; px < size; px++) {
      const i = (px + 0.5) / size;

      const dir = faceDirection(face, i, j);
      const { u, v } = directionToEquirect(dir);

      // Horizontal source footprint of this face pixel (numeric derivative,
      // wrap-aware): how many equirect pixels one output step covers.
      const dirNext = faceDirection(face, i + 1 / size, j);
      const uNext = directionToEquirect(dirNext).u;
      let du = Math.abs(uNext - u);
      if (du > 0.5) du = 1 - du; // crossed the wrap seam
      const scaleX = Math.max(1, Math.min(MAX_SCALE_X, du * width));

      sampleLanczos3(src, u * width - 0.5, v * height - 0.5, scaleX, out, (py * size + px) * 3);
    }
  }
  return out;
}
