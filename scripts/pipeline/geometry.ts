/**
 * Cube ↔ sphere ↔ equirect geometry for the tile pipeline (doc 07 §2).
 *
 * Conventions (documented once, used everywhere):
 *  - Right-handed, three.js-style axes: +X right, +Y up, −Z forward.
 *  - yaw in degrees, 0 = forward (−Z), positive = clockwise (toward +X), ±180.
 *  - pitch in degrees, up positive, ±90.
 *  - equirect u ∈ [0,1): u = (yaw+180)/360 (left edge = yaw −180);
 *    v ∈ [0,1]: v = (90−pitch)/180 (top edge = pitch +90 / zenith).
 *  - Face (i,j) ∈ [0,1]²: i → right, j → down in the face image.
 *
 * Face orientations are chosen edge-consistent (verified by the continuity
 * test across all 12 cube edges); the PSV-facing name mapping is confirmed
 * at the M1.1 spike and, if PSV differs, adjusted there as a name/flip table
 * — never by changing this geometry.
 */
import type { CubeFace } from '@virtual-gallery/engine';

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

const DEG = Math.PI / 180;

/** Unit direction for yaw/pitch in degrees. */
export function directionFromYawPitch(yawDeg: number, pitchDeg: number): Vec3 {
  const yaw = yawDeg * DEG;
  const pitch = pitchDeg * DEG;
  const c = Math.cos(pitch);
  return { x: c * Math.sin(yaw), y: Math.sin(pitch), z: -c * Math.cos(yaw) };
}

/**
 * Equirect texture coordinates (u wraps horizontally, v clamps).
 * Length-independent: accepts unnormalized directions (faceDirection output) —
 * both angles are computed from component ratios, never from asin(y) alone.
 */
export function directionToEquirect(dir: Vec3): { u: number; v: number } {
  const yaw = Math.atan2(dir.x, -dir.z); // radians, 0 = forward, cw positive
  const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
  let u = yaw / (2 * Math.PI) + 0.5;
  if (u >= 1) u -= 1;
  if (u < 0) u += 1;
  const v = 0.5 - pitch / Math.PI;
  return { u, v };
}

/**
 * Direction of a face pixel. (i, j) in [0,1] with (0,0) the top-left of the
 * face image. Not normalized (callers normalize or use ratios only).
 */
export function faceDirection(face: CubeFace, i: number, j: number): Vec3 {
  const a = 2 * i - 1; // left→right  → −1..+1
  const b = 1 - 2 * j; // top→bottom → +1..−1
  switch (face) {
    case 'front':
      return { x: a, y: b, z: -1 };
    case 'right':
      return { x: 1, y: b, z: a };
    case 'back':
      return { x: -a, y: b, z: 1 };
    case 'left':
      return { x: -1, y: b, z: -a };
    case 'up':
      // Pole faces follow PSV's cubemap convention exactly, derived from its
      // textureCoordsToSphericalCoords source (top: (−v,−u,−1), bottom:
      // (v,−u,1) in PSV's x-forward/y-right/z-down frame) — a horizontal
      // mirror of the naive net. 2026-07-09.
      return { x: -a, y: 1, z: 2 * j - 1 };
    case 'down':
      return { x: -a, y: -1, z: 1 - 2 * j };
  }
}

/** Inverse of faceDirection: which (i,j) on `face` sees `dir`. */
export function faceUV(face: CubeFace, dir: Vec3): { i: number; j: number } {
  let a: number;
  let b: number;
  let major: number;
  switch (face) {
    case 'front':
      major = -dir.z;
      a = dir.x;
      b = dir.y;
      break;
    case 'right':
      major = dir.x;
      a = dir.z;
      b = dir.y;
      break;
    case 'back':
      major = dir.z;
      a = -dir.x;
      b = dir.y;
      break;
    case 'left':
      major = -dir.x;
      a = -dir.z;
      b = dir.y;
      break;
    case 'up':
      major = dir.y;
      a = -dir.x;
      b = -dir.z;
      break;
    case 'down':
      major = -dir.y;
      a = -dir.x;
      b = dir.z;
      break;
  }
  return { i: (a / major + 1) / 2, j: (1 - b / major) / 2 };
}
