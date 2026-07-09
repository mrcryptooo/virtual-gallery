import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { CUBE_FACES, expectedPanoramaFiles } from '@virtual-gallery/engine';
import type { CubeFace, Panorama } from '@virtual-gallery/engine';
import { buildPyramid } from './tiler.ts';

const outDir = mkdtempSync(join(tmpdir(), 'vg-tiler-'));
afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

function solidFace(size: number, value: number): Uint8Array {
  return new Uint8Array(size * size * 3).fill(value);
}

describe('tile pyramid', () => {
  it('writes the exact canonical file set for a 1024-face pyramid', async () => {
    const faces = new Map<CubeFace, Uint8Array>(
      CUBE_FACES.map((face, index) => [face, solidFace(1024, 40 * index + 20)]),
    );
    const { files } = await buildPyramid({
      panoramaId: 'pano-test',
      version: 'cafe12345678',
      faceSize: 1024,
      faces,
      outDir,
    });

    // Same enumeration the validator uses: tiles only (no previews/posters in M0.5)
    const tiles: Panorama['tiles'] = {
      projection: 'cube',
      version: 'cafe12345678',
      tileSize: 512,
      faceSize: 1024,
      previewSize: 256,
      formats: ['png'],
    };
    const expected = expectedPanoramaFiles({
      id: 'pano-test',
      title: 'T',
      description: 'D',
      poster: { alt: 'A' },
      initialView: { yaw: 0, pitch: 0, fov: 90 },
      tiles,
      hotspots: [],
    }).filter((f) => f.startsWith('tiles/') && !f.includes('/preview/'));

    expect([...files].sort()).toEqual([...expected].sort());
    for (const file of files) {
      expect(existsSync(join(outDir, file))).toBe(true);
    }
  });

  it('every tile is exactly 512×512', async () => {
    const meta = await sharp(
      join(outDir, 'tiles/pano-test/cafe12345678/1024/front/1_1.png'),
    ).metadata();
    expect(meta.width).toBe(512);
    expect(meta.height).toBe(512);
  });

  it('level 512 is a downscale of the same face (not a crop)', async () => {
    // The 512 level of a solid face is still solid with the same value
    const { data } = await sharp(join(outDir, 'tiles/pano-test/cafe12345678/512/front/0_0.png'))
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(data[0]).toBe(20); // face index 0 → fill value 20
  });
});
