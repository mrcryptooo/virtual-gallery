/**
 * Master validation + decode (doc 07 §2 step 1): 2:1 aspect, minimum
 * resolution, sRGB. Reports every problem at once (contract §8).
 */
import sharp from 'sharp';
import type { RawImage } from './synthetic.ts';

/** Production minimum (doc 01 A2 / doc 07 §5); tests may relax via options. */
export const MIN_MASTER_WIDTH = 8192;

export interface MasterOptions {
  /** Test seam only — production callers use the default. */
  readonly minWidth?: number;
}

export interface MasterResult {
  readonly image: RawImage;
  readonly issues: readonly string[];
}

export async function loadMaster(path: string, options: MasterOptions = {}): Promise<MasterResult> {
  const minWidth = options.minWidth ?? MIN_MASTER_WIDTH;
  const issues: string[] = [];

  const probe = sharp(path, { limitInputPixels: 17000 * 8500 });
  const meta = await probe.metadata();
  const width = meta.width;
  const height = meta.height;

  if (width !== height * 2) {
    issues.push(
      `master must be 2:1 equirectangular — got ${String(width)}×${String(height)} (doc 07 §5)`,
    );
  }
  if (width < minWidth) {
    issues.push(
      `master must be at least ${String(minWidth)}×${String(minWidth / 2)} — got ${String(width)}×${String(height)} (doc 07 §5)`,
    );
  }
  if (meta.space !== 'srgb' && meta.space !== 'rgb') {
    issues.push(`master must be sRGB — got colorspace "${meta.space}" (doc 07 §4)`);
  }

  if (issues.length > 0) {
    return { image: { data: new Uint8Array(0), width, height }, issues };
  }

  const { data } = await sharp(path, { limitInputPixels: 17000 * 8500 })
    .removeAlpha()
    .toColorspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });

  return {
    image: { data: new Uint8Array(data.buffer, data.byteOffset, data.byteLength), width, height },
    issues: [],
  };
}

/** Deepest cube-face size for a master: nearest power-of-two × 512 ≤ width/4. */
export function faceSizeForMaster(width: number): number {
  const target = width / 4;
  let size = 512;
  while (size * 2 <= target) size *= 2;
  return size;
}
