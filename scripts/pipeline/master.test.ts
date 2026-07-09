import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterAll, describe, expect, it } from 'vitest';
import { faceSizeForMaster, loadMaster } from './master.ts';

const scratch = mkdtempSync(join(tmpdir(), 'vg-master-'));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});

async function writePng(name: string, width: number, height: number): Promise<string> {
  const path = join(scratch, name);
  await sharp(new Uint8Array(width * height * 3).fill(128), {
    raw: { width, height, channels: 3 },
  })
    .png()
    .toFile(path);
  return path;
}

describe('master validation (doc 07 §5)', () => {
  it('accepts a valid 2:1 master (relaxed width for the test)', async () => {
    const path = await writePng('ok.png', 1024, 512);
    const { image, issues } = await loadMaster(path, { minWidth: 1024 });
    expect(issues).toEqual([]);
    expect(image.width).toBe(1024);
    expect(image.data.length).toBe(1024 * 512 * 3);
  });

  it('rejects a non-2:1 aspect ratio', async () => {
    const path = await writePng('square.png', 1024, 1024);
    const { issues } = await loadMaster(path, { minWidth: 1024 });
    expect(issues.join('\n')).toMatch(/2:1 equirectangular/);
  });

  it('rejects an undersized master at the production default', async () => {
    const path = await writePng('small.png', 4096, 2048);
    const { issues } = await loadMaster(path);
    expect(issues.join('\n')).toMatch(/at least 8192×4096/);
  });

  it('reports all problems at once (contract §8)', async () => {
    const path = await writePng('bad.png', 1000, 900);
    const { issues } = await loadMaster(path);
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });

  it('derives the deepest face size as power-of-two × 512', () => {
    expect(faceSizeForMaster(16384)).toBe(4096);
    expect(faceSizeForMaster(8192)).toBe(2048);
    expect(faceSizeForMaster(2048)).toBe(512);
    expect(faceSizeForMaster(12000)).toBe(2048); // rounds down, never up
  });
});
