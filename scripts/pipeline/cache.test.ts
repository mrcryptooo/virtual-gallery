import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { computeVersion, isCached, writeMarker } from './cache.ts';

const scratch = mkdtempSync(join(tmpdir(), 'vg-cache-'));
const cacheDir = join(scratch, '.asset-cache');
const outDir = join(scratch, 'out');
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

describe('incremental cache', () => {
  it('derives a stable 12-hex version from master bytes', () => {
    const a = computeVersion(new Uint8Array([1, 2, 3]));
    expect(a).toMatch(/^[0-9a-f]{12}$/);
    expect(computeVersion(new Uint8Array([1, 2, 3]))).toBe(a); // deterministic
    expect(computeVersion(new Uint8Array([1, 2, 4]))).not.toBe(a); // content-sensitive
  });

  it('reports a hit only when the marker AND all outputs exist', () => {
    const version = computeVersion(new Uint8Array([9]));
    const files = ['tiles/p/x/512/front/0_0.png'];

    expect(isCached(cacheDir, 'p', version, outDir)).toBe(false); // no marker yet

    writeMarker(cacheDir, 'p', version, files);
    expect(isCached(cacheDir, 'p', version, outDir)).toBe(false); // outputs missing

    const target = join(outDir, files[0] ?? '');
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, 'x');
    expect(isCached(cacheDir, 'p', version, outDir)).toBe(true); // hit

    rmSync(target);
    expect(isCached(cacheDir, 'p', version, outDir)).toBe(false); // wiped output invalidates
  });

  it('a changed master yields a different version (cache miss by construction)', () => {
    const v1 = computeVersion(new Uint8Array([1]));
    writeMarker(cacheDir, 'q', v1, []);
    const v2 = computeVersion(new Uint8Array([2]));
    expect(isCached(cacheDir, 'q', v2, outDir)).toBe(false);
  });
});
