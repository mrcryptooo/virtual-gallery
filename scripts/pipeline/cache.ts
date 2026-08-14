/**
 * Incremental pipeline cache (doc 07 §6): outputs are keyed by a content
 * hash of the master file plus a pipeline-parameters salt — only changed
 * panoramas (or a changed pipeline) reprocess. The hash doubles as the
 * cache-busting `version` path segment of the package contract (§17).
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Bump when reprojection/tiling output would change for identical input. */
export const PIPELINE_SALT = 'pipeline-m0.5-v3'; // v3: pole faces mirrored per PSV source-derived convention

export const CACHE_DIR = '.asset-cache';

/** Content-hash version segment (contract §17): 12 hex chars. */
export function computeVersion(masterBytes: Uint8Array): string {
  return createHash('sha256').update(PIPELINE_SALT).update(masterBytes).digest('hex').slice(0, 12);
}

interface CacheMarker {
  readonly version: string;
  readonly files: readonly string[];
}

function markerPath(cacheDir: string, panoramaId: string, version: string): string {
  return join(cacheDir, `${panoramaId}-${version}.json`);
}

/**
 * True when this master@version was already produced AND every recorded
 * output file still exists (a wiped outDir invalidates the cache honestly).
 */
export function isCached(
  cacheDir: string,
  panoramaId: string,
  version: string,
  outDir: string,
): boolean {
  const path = markerPath(cacheDir, panoramaId, version);
  if (!existsSync(path)) return false;
  try {
    const marker = JSON.parse(readFileSync(path, 'utf8')) as CacheMarker;
    return marker.version === version && marker.files.every((f) => existsSync(join(outDir, f)));
  } catch {
    return false;
  }
}

export function writeMarker(
  cacheDir: string,
  panoramaId: string,
  version: string,
  files: readonly string[],
): void {
  const path = markerPath(cacheDir, panoramaId, version);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify({ version, files } satisfies CacheMarker, null, 2));
}
