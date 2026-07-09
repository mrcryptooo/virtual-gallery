import { describe, expect, it } from 'vitest';
import { CUBE_FACES } from '@virtual-gallery/engine';
import { directionFromYawPitch, directionToEquirect, faceDirection, faceUV } from './geometry.ts';

describe('geometry conventions', () => {
  it('maps cardinal yaw/pitch to the documented axes', () => {
    const front = directionFromYawPitch(0, 0);
    expect(front.z).toBeCloseTo(-1);
    const right = directionFromYawPitch(90, 0);
    expect(right.x).toBeCloseTo(1);
    const up = directionFromYawPitch(0, 90);
    expect(up.y).toBeCloseTo(1);
  });

  it('maps directions to equirect uv (known correspondences)', () => {
    // forward → horizontal center; zenith → top edge
    expect(directionToEquirect({ x: 0, y: 0, z: -1 })).toEqual({ u: 0.5, v: 0.5 });
    expect(directionToEquirect({ x: 0, y: 1, z: 0 }).v).toBeCloseTo(0);
    expect(directionToEquirect({ x: 0, y: -1, z: 0 }).v).toBeCloseTo(1);
    // yaw +90 (east) → u = 0.75
    expect(directionToEquirect({ x: 1, y: 0, z: 0 }).u).toBeCloseTo(0.75);
    // yaw −90 (west) → u = 0.25
    expect(directionToEquirect({ x: -1, y: 0, z: 0 }).u).toBeCloseTo(0.25);
  });

  it('face centers look along their axes', () => {
    expect(faceDirection('front', 0.5, 0.5)).toEqual({ x: 0, y: 0, z: -1 });
    expect(faceDirection('right', 0.5, 0.5)).toEqual({ x: 1, y: 0, z: 0 });
    expect(faceDirection('back', 0.5, 0.5)).toEqual({ x: -0, y: 0, z: 1 });
    expect(faceDirection('up', 0.5, 0.5)).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('faceUV inverts faceDirection across all faces (roundtrip)', () => {
    for (const face of CUBE_FACES) {
      for (const [i, j] of [
        [0.1, 0.2],
        [0.5, 0.5],
        [0.9, 0.7],
        [0.25, 0.95],
      ] as const) {
        const dir = faceDirection(face, i, j);
        const uv = faceUV(face, dir);
        expect(uv.i).toBeCloseTo(i, 10);
        expect(uv.j).toBeCloseTo(j, 10);
      }
    }
  });
});
