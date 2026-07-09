/**
 * Package builder CLI (doc 07 §2). Two modes:
 *
 * Single panorama (M0.5 core stages):
 *   node scripts/build-package.ts <master> <outDir> --pano-id <slug>
 *        [--min-width <px>] [--emit-faces]
 *
 * Whole project (authoring → published package):
 *   node scripts/build-package.ts --project <slug> [--min-width <px>]
 *   Reads  content-src/<slug>/{project.authoring.json, panos/*}
 *   Writes apps/portfolio/public/projects/<slug>/ (tiles, previews, posters,
 *   stamped + validated project.json)
 *
 * Still M0.6-incomplete by design: PNG-only (no AVIF/WebP ladder), no
 * banding/seam quality gates, no per-asset budget enforcement.
 * `--min-width` is the sanctioned test seam for sub-8K test assets.
 */
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import sharp from 'sharp';
import {
  CUBE_FACES,
  parseProjectManifest,
  validateProjectInvariants,
  previewPath,
  posterPath,
  thumbPath,
} from '@virtual-gallery/engine';
import type { CubeFace, Panorama, View } from '@virtual-gallery/engine';
import { CACHE_DIR, computeVersion, isCached, writeMarker } from './pipeline/cache.ts';
import { faceSizeForMaster, loadMaster } from './pipeline/master.ts';
import { reprojectFace } from './pipeline/reproject.ts';
import { renderPoster, renderPreviewFace, renderThumbFromPoster } from './pipeline/renders.ts';
import { buildPyramid } from './pipeline/tiler.ts';

interface BuildOptions {
  readonly minWidth?: number;
  readonly emitFaces?: boolean;
}

interface BuildResult {
  readonly version: string;
  readonly faceSize: number;
}

function tilesMetaFor(version: string, faceSize: number): Panorama['tiles'] {
  return {
    projection: 'cube',
    version,
    tileSize: 512,
    faceSize,
    previewSize: 256,
    formats: ['png'],
  };
}

/** Full per-panorama build: validate → reproject → tiles → previews → poster. */
async function buildPanorama(
  masterPath: string,
  panoramaId: string,
  outDir: string,
  posterView: View,
  options: BuildOptions,
): Promise<BuildResult> {
  const masterBytes = readFileSync(masterPath);
  const version = computeVersion(masterBytes);

  // Probe dimensions cheaply for meta even on cache hit
  const probe = await sharp(masterPath).metadata();
  const faceSize = faceSizeForMaster(probe.width);

  if (isCached(CACHE_DIR, panoramaId, version, outDir)) {
    console.log(`[pipeline] ${panoramaId}@${version}: cache hit — nothing to do.`);
    return { version, faceSize };
  }

  const { image, issues } = await loadMaster(
    masterPath,
    options.minWidth !== undefined ? { minWidth: options.minWidth } : {},
  );
  if (issues.length > 0) {
    console.error(`[pipeline] ${panoramaId}: master rejected:`);
    for (const issue of issues) console.error(`  ✗ ${issue}`);
    process.exit(1);
  }

  console.log(
    `[pipeline] ${panoramaId}@${version}: master ${String(image.width)}×${String(image.height)} → faces ${String(faceSize)}px`,
  );

  const faces = new Map<CubeFace, Uint8Array>();
  for (const face of CUBE_FACES) {
    const faceStart = Date.now();
    faces.set(face, reprojectFace(image, face, faceSize));
    console.log(`[pipeline]   reprojected ${face} in ${String(Date.now() - faceStart)} ms`);
  }

  if (options.emitFaces === true) {
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

  const tilesMeta = tilesMetaFor(version, faceSize);
  const { files } = await buildPyramid({ panoramaId, version, faceSize, faces, outDir });
  const allFiles = [...files];

  // Preview cube (doc 07 §3) — the instant first view and transition source
  for (const face of CUBE_FACES) {
    const buffer = faces.get(face);
    if (buffer === undefined) continue;
    const rel = previewPath(panoramaId, tilesMeta, face, 'png');
    const target = join(outDir, rel);
    await mkdir(join(target, '..'), { recursive: true });
    await writeFile(target, await renderPreviewFace(buffer, faceSize));
    allFiles.push(rel);
  }

  // Poster + thumb from the authored view
  const poster = await renderPoster(image, posterView);
  const posterRel = posterPath(panoramaId, 'png');
  const thumbRel = thumbPath(panoramaId, 'png');
  await mkdir(join(outDir, 'posters'), { recursive: true });
  await writeFile(join(outDir, posterRel), poster);
  await writeFile(join(outDir, thumbRel), await renderThumbFromPoster(poster));
  allFiles.push(posterRel, thumbRel);

  writeMarker(CACHE_DIR, panoramaId, version, allFiles);
  console.log(`[pipeline] ${panoramaId}@${version}: ${String(allFiles.length)} files written.`);
  return { version, faceSize };
}

function arg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const minWidthArg = arg('--min-width');
const buildOptions: BuildOptions = {
  ...(minWidthArg !== undefined ? { minWidth: Number(minWidthArg) } : {}),
  emitFaces: process.argv.includes('--emit-faces'),
};

const projectSlug = arg('--project');

if (projectSlug !== undefined) {
  // ── Project mode: authoring manifest + masters → published package ────────
  const srcDir = join('content-src', projectSlug);
  const outDir = join('apps', 'portfolio', 'public', 'projects', projectSlug);
  const authoringPath = join(srcDir, 'project.authoring.json');
  if (!existsSync(authoringPath)) {
    console.error(`[pipeline] ${authoringPath} not found`);
    process.exit(1);
  }

  // Authoring manifest = published manifest minus pipeline-derived tiles meta.
  // Structure is validated AFTER stamping (tiles are required by the schema).
  const authoring = JSON.parse(readFileSync(authoringPath, 'utf8')) as Record<string, unknown>;

  const findMaster = (panoId: string): string => {
    for (const ext of ['png', 'jpg', 'jpeg', 'tif', 'tiff']) {
      const candidate = join(srcDir, 'panos', `${panoId}.${ext}`);
      if (existsSync(candidate)) return candidate;
    }
    console.error(`[pipeline] no master found for panorama "${panoId}" in ${srcDir}/panos/`);
    process.exit(1);
  };

  // Walk the authored hierarchy, build each panorama, stamp tiles meta
  const buildings = authoring['buildings'] as {
    floors: { rooms: { panoramas: (Record<string, unknown> & { id: string })[] }[] }[];
  }[];
  const started = Date.now();
  let count = 0;
  for (const building of buildings) {
    for (const floor of building.floors) {
      for (const room of floor.rooms) {
        for (const pano of room.panoramas) {
          const initialView = pano['initialView'] as View;
          const { version, faceSize } = await buildPanorama(
            findMaster(pano.id),
            pano.id,
            outDir,
            initialView,
            buildOptions,
          );
          pano['tiles'] = tilesMetaFor(version, faceSize);
          count += 1;
        }
      }
    }
  }

  // Validate the stamped manifest with the real contract before publishing
  const parsed = parseProjectManifest(authoring);
  if (!parsed.ok) {
    console.error('[pipeline] stamped manifest is invalid:');
    for (const issue of parsed.issues) console.error(`  ✗ ${issue}`);
    process.exit(1);
  }
  const invariantIssues = validateProjectInvariants(parsed.project);
  if (invariantIssues.length > 0) {
    console.error('[pipeline] manifest invariants failed:');
    for (const issue of invariantIssues) console.error(`  ✗ ${issue}`);
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, 'project.json'), JSON.stringify(parsed.project, null, 2));
  console.log(
    `[pipeline] project "${projectSlug}": ${String(count)} panorama(s) → ${outDir} in ${String(
      Date.now() - started,
    )} ms. Run \`pnpm validate:content\` to gate.`,
  );
} else {
  // ── Single-panorama mode (M0.5) ────────────────────────────────────────────
  const [, , masterPath, outDir] = process.argv;
  const panoramaId = arg('--pano-id');
  if (masterPath === undefined || outDir === undefined || panoramaId === undefined) {
    console.error(
      'Usage: node scripts/build-package.ts <master> <outDir> --pano-id <slug> [--min-width <px>] [--emit-faces]\n' +
        '       node scripts/build-package.ts --project <slug> [--min-width <px>]',
    );
    process.exit(1);
  }
  const view: View = { yaw: 0, pitch: 0, fov: 90 };
  await buildPanorama(masterPath, panoramaId, outDir, view, buildOptions);
}
