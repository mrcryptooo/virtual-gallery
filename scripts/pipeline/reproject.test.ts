import { describe, expect, it } from 'vitest';
import { CUBE_FACES } from '@virtual-gallery/engine';
import type { CubeFace } from '@virtual-gallery/engine';
import { faceDirection, faceUV } from './geometry.ts';
import { reprojectFace } from './reproject.ts';
import { generateSyntheticEquirect, MARKERS } from './synthetic.ts';

/**
 * The synthetic master at test scale: 2048×1024 → 512-px faces exercises the
 * exact code paths CI needs fast; the 16384×8192 run is the local/manual
 * inspection asset (doc 12 M0.5 review checkpoint).
 */
const SRC = generateSyntheticEquirect(2048);
const FACE_SIZE = 512;

const faces = new Map<CubeFace, Uint8Array>(
  CUBE_FACES.map((face) => [face, reprojectFace(SRC, face, FACE_SIZE)]),
);

/** Bilinear sample of a rendered face at fractional (i, j) ∈ [0,1]. */
function sampleFace(face: CubeFace, i: number, j: number): [number, number, number] {
  const data = faces.get(face);
  if (data === undefined) throw new Error(`missing face ${face}`);
  const x = Math.min(FACE_SIZE - 1.001, Math.max(0, i * FACE_SIZE - 0.5));
  const y = Math.min(FACE_SIZE - 1.001, Math.max(0, j * FACE_SIZE - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const px = (xx: number, yy: number, c: number) => data[(yy * FACE_SIZE + xx) * 3 + c] ?? 0;
  const channel = (c: number) =>
    px(x0, y0, c) * (1 - fx) * (1 - fy) +
    px(x0 + 1, y0, c) * fx * (1 - fy) +
    px(x0, y0 + 1, c) * (1 - fx) * fy +
    px(x0 + 1, y0 + 1, c) * fx * fy;
  return [channel(0), channel(1), channel(2)];
}

describe('reprojection orientation (cardinal markers)', () => {
  it.each([
    ['front', MARKERS.front],
    ['right', MARKERS.right],
    ['back', MARKERS.back],
    ['left', MARKERS.left],
    ['up', MARKERS.up],
    ['down', MARKERS.down],
  ] as const)('%s face center shows its marker color', (face, [r, g, b]) => {
    const [sr, sg, sb] = sampleFace(face, 0.5, 0.5);
    expect(Math.abs(sr - r)).toBeLessThan(30);
    expect(Math.abs(sg - g)).toBeLessThan(30);
    expect(Math.abs(sb - b)).toBeLessThan(30);
  });
});

describe('cube-edge continuity (all 12 edges)', () => {
  // Each edge as its two shared corner directions; adjacency is derived
  // geometrically (convention-independent — guards the face definitions).
  const corners: Record<string, [number, number, number]> = {
    a: [-1, 1, -1],
    b: [1, 1, -1],
    c: [1, 1, 1],
    d: [-1, 1, 1],
    e: [-1, -1, -1],
    f: [1, -1, -1],
    g: [1, -1, 1],
    h: [-1, -1, 1],
  };
  const edges: [string, string, CubeFace, CubeFace][] = [
    ['a', 'b', 'up', 'front'],
    ['b', 'c', 'up', 'right'],
    ['c', 'd', 'up', 'back'],
    ['d', 'a', 'up', 'left'],
    ['e', 'f', 'down', 'front'],
    ['f', 'g', 'down', 'right'],
    ['g', 'h', 'down', 'back'],
    ['h', 'e', 'down', 'left'],
    ['a', 'e', 'front', 'left'],
    ['b', 'f', 'front', 'right'],
    ['c', 'g', 'back', 'right'],
    ['d', 'h', 'back', 'left'],
  ];

  it.each(edges)('edge %s–%s: %s ↔ %s match', (c0, c1, faceA, faceB) => {
    const p0 = corners[c0];
    const p1 = corners[c1];
    if (p0 === undefined || p1 === undefined) throw new Error('bad corner');
    const K = 64;
    let total = 0;
    for (let k = 1; k < K; k++) {
      const t = k / K;
      const dir = {
        x: p0[0] + (p1[0] - p0[0]) * t,
        y: p0[1] + (p1[1] - p0[1]) * t,
        z: p0[2] + (p1[2] - p0[2]) * t,
      };
      const uvA = faceUV(faceA, dir);
      const uvB = faceUV(faceB, dir);
      const a = sampleFace(faceA, uvA.i, uvA.j);
      const b = sampleFace(faceB, uvB.i, uvB.j);
      total +=
        (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2])) / 3 / (K - 1);
    }
    expect(total).toBeLessThan(6); // mean abs diff across the edge, 0–255 scale
  });

  it('sanity: the two faces of an edge really see the same directions', () => {
    // Midpoint of the up/front edge lies on both faces' borders
    const dir = { x: 0, y: 1, z: -1 };
    const uvUp = faceUV('up', dir);
    const uvFront = faceUV('front', dir);
    // PSV-convention up face (mirrored net): front sits at its TOP row
    expect(uvUp.j).toBeCloseTo(0);
    expect(uvFront.j).toBeCloseTo(0); // top row of `front` faces up
    expect(faceDirection('up', uvUp.i, uvUp.j).z).toBeCloseTo(-1);
  });
});
