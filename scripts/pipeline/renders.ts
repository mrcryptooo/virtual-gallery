/**
 * Derived renders (doc 07 §3): per-panorama preview cube (6×256, instant
 * first view + transition source) and poster/thumb (perspective view of the
 * authored initial view, used by cards, Space Index, and OG images).
 */
import sharp from 'sharp';
import type { CubeFace, View } from '@virtual-gallery/engine';
import { directionFromYawPitch, directionToEquirect, type Vec3 } from './geometry.ts';
import { sampleLanczos3 } from './reproject.ts';
import type { RawImage } from './synthetic.ts';

export const PREVIEW_SIZE = 256;
export const POSTER_WIDTH = 2048;
export const POSTER_HEIGHT = 1152; // 16:9
export const THUMB_WIDTH = 480;

/** Downscale a deepest-level face buffer to the 256-px preview face. */
export async function renderPreviewFace(face: Uint8Array, faceSize: number): Promise<Buffer> {
  return sharp(face, { raw: { width: faceSize, height: faceSize, channels: 3 } })
    .resize(PREVIEW_SIZE, PREVIEW_SIZE, { kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

/**
 * Gnomonic (rectilinear) render of the equirect master at an authored view —
 * what a visitor facing `view` actually sees, as a flat photo.
 */
export function renderPerspective(
  src: RawImage,
  view: View,
  width: number,
  height: number,
): Uint8Array {
  const out = new Uint8Array(width * height * 3);

  const forward = directionFromYawPitch(view.yaw, view.pitch);
  const worldUp: Vec3 = { x: 0, y: 1, z: 0 };
  // right = normalize(forward × up); up' = right × forward
  const rx = forward.y * worldUp.z - forward.z * worldUp.y;
  const ry = forward.z * worldUp.x - forward.x * worldUp.z;
  const rz = forward.x * worldUp.y - forward.y * worldUp.x;
  const rlen = Math.hypot(rx, ry, rz) || 1;
  // forward × worldUp at yaw 0 is +X — already screen-right for +yaw = clockwise
  const right: Vec3 = { x: rx / rlen, y: ry / rlen, z: rz / rlen };
  const up: Vec3 = {
    x: right.y * forward.z - right.z * forward.y,
    y: right.z * forward.x - right.x * forward.z,
    z: right.x * forward.y - right.y * forward.x,
  };

  const tanH = Math.tan(((view.fov / 2) * Math.PI) / 180);
  const tanV = (tanH * height) / width;

  for (let py = 0; py < height; py++) {
    const ndcY = 1 - ((py + 0.5) / height) * 2;
    for (let px = 0; px < width; px++) {
      const ndcX = ((px + 0.5) / width) * 2 - 1;
      const dir: Vec3 = {
        x: forward.x + ndcX * tanH * right.x + ndcY * tanV * up.x,
        y: forward.y + ndcX * tanH * right.y + ndcY * tanV * up.y,
        z: forward.z + ndcX * tanH * right.z + ndcY * tanV * up.z,
      };
      const { u, v } = directionToEquirect(dir);
      sampleLanczos3(src, u * src.width - 0.5, v * src.height - 0.5, 1, out, (py * width + px) * 3);
    }
  }
  return out;
}

export async function renderPoster(src: RawImage, view: View): Promise<Buffer> {
  const pixels = renderPerspective(src, view, POSTER_WIDTH, POSTER_HEIGHT);
  return sharp(pixels, { raw: { width: POSTER_WIDTH, height: POSTER_HEIGHT, channels: 3 } })
    .png()
    .toBuffer();
}

export async function renderThumbFromPoster(poster: Buffer): Promise<Buffer> {
  return sharp(poster)
    .resize(THUMB_WIDTH, Math.round((THUMB_WIDTH * POSTER_HEIGHT) / POSTER_WIDTH), {
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer();
}

/** Which cube face a view direction lands on (used to sanity-check posters). */
export function dominantFace(view: View): CubeFace {
  const d = directionFromYawPitch(view.yaw, view.pitch);
  const ax = Math.abs(d.x);
  const ay = Math.abs(d.y);
  const az = Math.abs(d.z);
  if (ay >= ax && ay >= az) return d.y > 0 ? 'up' : 'down';
  if (ax >= az) return d.x > 0 ? 'right' : 'left';
  return d.z < 0 ? 'front' : 'back';
}
