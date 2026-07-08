/**
 * Regenerates the placeholder imagery of the fixture package(s) from their
 * project.json — solid-color PNGs at contract-correct sizes and paths
 * (doc 12 M0.4: "placeholder-colored tiles/previews/posters at correct
 * sizes and paths"). Outputs are committed; rerun only when the fixture
 * manifest changes:
 *
 *   node packages/engine/test/fixtures/generate-fixture.mjs
 *
 * Requires Node ≥ 22.18 (type stripping) to import the domain path scheme —
 * the same single source of truth the validator and pipeline use.
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { parseProjectManifest } from '../../src/index.ts';
import { expectedPackageFiles } from '../../src/domain/manifest/paths.ts';

const FIXTURES_DIR = dirname(fileURLToPath(import.meta.url));

// ── Minimal PNG writer (solid color, RGB8) ───────────────────────────────────
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), 8 + data.length);
  return out;
}

function solidPng(width, height, [r, g, b]) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const row = Buffer.alloc(1 + width * 3); // filter byte 0 + pixels
  for (let x = 0; x < width; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Placeholder palette: one distinct color per panorama id ─────────────────
const PALETTE = [
  [79, 70, 229], // indigo
  [13, 148, 136], // teal
  [217, 119, 6], // amber
  [14, 165, 233], // sky
  [22, 163, 74], // green
  [225, 29, 72], // rose
];

function colorFor(panoramaId, panoramaIds) {
  return PALETTE[panoramaIds.indexOf(panoramaId) % PALETTE.length];
}

/** Pixel dimensions per asset class, derived from the file's path. */
function sizeFor(relPath) {
  if (relPath.includes('/preview/')) return [256, 256];
  if (relPath.endsWith('-thumb.png')) return [480, 300];
  if (relPath.startsWith('posters/')) return [2048, 1280];
  return [512, 512]; // tiles are always exactly tileSize (doc 07 §2)
}

// ── Generate every fixture package in this directory ────────────────────────
for (const entry of readdirSync(FIXTURES_DIR, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const packageDir = join(FIXTURES_DIR, entry.name);
  const manifestRaw = JSON.parse(readFileSync(join(packageDir, 'project.json'), 'utf8'));
  const parsed = parseProjectManifest(manifestRaw);
  if (!parsed.ok) {
    console.error(`[pipeline] generate-fixture: ${entry.name}/project.json invalid:`);
    for (const issue of parsed.issues) console.error(`  ✗ ${issue}`);
    process.exit(1);
  }

  const panoramaIds = [];
  for (const b of parsed.project.buildings)
    for (const f of b.floors)
      for (const r of f.rooms) for (const p of r.panoramas) panoramaIds.push(p.id);

  let written = 0;
  for (const relPath of expectedPackageFiles(parsed.project)) {
    const panoramaId =
      panoramaIds.find(
        (id) =>
          relPath.includes(`/${id}/`) ||
          relPath.includes(`/${id}.`) ||
          relPath.includes(`/${id}-thumb.`),
      ) ?? panoramaIds[0];
    const [w, h] = sizeFor(relPath);
    const target = join(packageDir, relPath);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, solidPng(w, h, colorFor(panoramaId, panoramaIds)));
    written++;
  }
  console.log(`[pipeline] generate-fixture: ${entry.name} — ${String(written)} files written.`);
}
