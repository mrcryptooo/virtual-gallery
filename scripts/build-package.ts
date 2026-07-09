/**
 * Package builder CLI — M0.5 stages: validate master → reproject to cube
 * faces (Lanczos3, pole oversampling) → tile pyramid (PNG) → incremental
 * cache. M0.6 completes it (AVIF/WebP ladder, previews, posters, quality
 * gates, authoring-manifest stamping).
 *
 * Usage:
 *   node scripts/build-package.ts <master> <outDir> --pano-id <slug>
 *        [--min-width <px>] [--emit-faces]
 *
 * Requires Node ≥ 22.18 (native type stripping).
 */
import { readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import { CUBE_FACES } from '@virtual-gallery/engine';
import type { CubeFace } from '@virtual-gallery/engine';
import { CACHE_DIR, computeVersion, isCached, writeMarker } from './pipeline/cache.ts';
import { faceSizeForMaster, loadMaster } from './pipeline/master.ts';
import { reprojectFace } from './pipeline/reproject.ts';
import { buildPyramid } from './pipeline/tiler.ts';

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const [, , masterPath, outDir] = process.argv;
const panoramaId = arg('--pano-id');
const minWidthArg = arg('--min-width');
const emitFaces = process.argv.includes('--emit-faces');

if (masterPath === undefined || outDir === undefined || panoramaId === undefined) {
  console.error(
    'Usage: node scripts/build-package.ts <master> <outDir> --pano-id <slug> [--min-width <px>] [--emit-faces]',
  );
  process.exit(1);
}

const started = Date.now();
const masterBytes = readFileSync(masterPath);
const version = computeVersion(masterBytes);

if (isCached(CACHE_DIR, panoramaId, version, outDir)) {
  console.log(`[pipeline] ${panoramaId}@${version}: cache hit — nothing to do.`);
  process.exit(0);
}

const { image, issues } = await loadMaster(
  masterPath,
  minWidthArg !== undefined ? { minWidth: Number(minWidthArg) } : {},
);
if (issues.length > 0) {
  console.error(`[pipeline] ${panoramaId}: master rejected:`);
  for (const issue of issues) console.error(`  ✗ ${issue}`);
  process.exit(1);
}

const faceSize = faceSizeForMaster(image.width);
console.log(
  `[pipeline] ${panoramaId}@${version}: master ${String(image.width)}×${String(image.height)} → faces ${String(faceSize)}px`,
);

const faces = new Map<CubeFace, Uint8Array>();
for (const face of CUBE_FACES) {
  const faceStart = Date.now();
  faces.set(face, reprojectFace(image, face, faceSize));
  console.log(`[pipeline]   reprojected ${face} in ${String(Date.now() - faceStart)} ms`);
}

if (emitFaces) {
  const facesDir = join(outDir, '_faces', `${panoramaId}-${version}`);
  await mkdir(facesDir, { recursive: true });
  for (const face of CUBE_FACES) {
    const buffer = faces.get(face);
    if (buffer === undefined) continue;
    await writeFile(
      join(facesDir, `${face}.png`),
      await sharp(buffer, { raw: { width: faceSize, height: faceSize, channels: 3 } })
        .png()
        .toBuffer(),
    );
  }
  console.log(`[pipeline]   face previews → ${facesDir}`);
}

const { files } = await buildPyramid({ panoramaId, version, faceSize, faces, outDir });
writeMarker(CACHE_DIR, panoramaId, version, files);

console.log(
  `[pipeline] ${panoramaId}@${version}: ${String(files.length)} tiles written in ${String(
    Date.now() - started,
  )} ms.`,
);
console.log(
  `[pipeline]   tiles meta: ${JSON.stringify({
    projection: 'cube',
    version,
    tileSize: 512,
    faceSize,
    previewSize: 256,
    formats: ['png'],
  })}`,
);
