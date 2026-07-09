/**
 * Quadtree tiling (doc 07 §2 step 3): slice each cube face into the level
 * ladder of 512-px tiles, in the canonical package layout (engine paths.ts —
 * the single source of truth shared with the validator and loader).
 * Lower levels are Lanczos3 downscales of the deepest face.
 *
 * M0.5 emits PNG only; the AVIF/WebP encoding ladder is M0.6.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { CUBE_FACES, levelFaceSizes, tilePath, tilesPerAxis } from '@virtual-gallery/engine';
import type { CubeFace } from '@virtual-gallery/engine';

const TILE_SIZE = 512;

export interface TilerInput {
  readonly panoramaId: string;
  readonly version: string;
  readonly faceSize: number;
  /** Deepest-level face pixels, RGB. */
  readonly faces: ReadonlyMap<CubeFace, Uint8Array>;
  readonly outDir: string;
}

export interface TilerResult {
  /** Package-relative paths of every tile written. */
  readonly files: readonly string[];
}

export async function buildPyramid(input: TilerInput): Promise<TilerResult> {
  const { panoramaId, version, faceSize, faces, outDir } = input;
  const tilesMeta = { version, tileSize: TILE_SIZE as 512, faceSize };
  const files: string[] = [];

  for (const face of CUBE_FACES) {
    const deepest = faces.get(face);
    if (deepest === undefined) {
      throw new Error(`[pipeline] tiler: missing face buffer "${face}"`);
    }

    for (const levelSize of levelFaceSizes(tilesMeta)) {
      // Level image: the deepest buffer as-is, or a Lanczos3 downscale of it
      const level =
        levelSize === faceSize
          ? sharp(deepest, { raw: { width: faceSize, height: faceSize, channels: 3 } })
          : sharp(deepest, { raw: { width: faceSize, height: faceSize, channels: 3 } }).resize(
              levelSize,
              levelSize,
              { kernel: 'lanczos3' },
            );
      const levelBuffer = await level.raw().toBuffer();

      const n = tilesPerAxis(levelSize, TILE_SIZE);
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const relPath = tilePath(
            panoramaId,
            { ...tilesMeta, projection: 'cube', previewSize: 256, formats: ['png'] },
            levelSize,
            face,
            x,
            y,
            'png',
          );
          const target = join(outDir, relPath);
          await mkdir(dirname(target), { recursive: true });
          await writeFile(
            target,
            await sharp(levelBuffer, { raw: { width: levelSize, height: levelSize, channels: 3 } })
              .extract({
                left: x * TILE_SIZE,
                top: y * TILE_SIZE,
                width: TILE_SIZE,
                height: TILE_SIZE,
              })
              .png()
              .toBuffer(),
          );
          files.push(relPath);
        }
      }
    }
  }

  return { files };
}
