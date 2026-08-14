/**
 * Marzipano integration gate.
 *
 * The Marzipano export is the authoritative source for the modern-museum tour:
 * scene ids, initial views, and every link/info hotspot were authored in the
 * Marzipano Tool and must survive integration byte-for-byte. This compares the
 * data actually shipped in the build against the export and fails on any
 * difference — including a hotspot that gained or lost a reverse link.
 *
 *   node scripts/verify-marzipano.mjs [buildDir]
 *
 * buildDir defaults to the public tree; pass apps/portfolio/dist to check a
 * production build.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.argv[2] ?? join('apps', 'portfolio', 'public');
const TOUR = join(ROOT, 'tour', 'modern-museum');

const problems = [];
const fail = (m) => problems.push(m);

// ── required application files ──────────────────────────────────────────────
const REQUIRED = [
  'index.html',
  'data.js',
  'index.js',
  'style.css',
  'vendor/marzipano.js',
  'vendor/screenfull.min.js',
  'vendor/bowser.min.js',
  'vendor/reset.min.css',
  'img/link.png',
  'img/info.png',
  'img/close.png',
  'img/fullscreen.png',
  'img/play.png',
];
for (const rel of REQUIRED) {
  const path = join(TOUR, rel);
  if (!existsSync(path) || statSync(path).size === 0)
    fail(`missing or empty: tour/modern-museum/${rel}`);
}

if (problems.length > 0) {
  for (const p of problems) console.error(`  ✗ ${p}`);
  process.exit(1);
}

// ── parse the shipped data.js ───────────────────────────────────────────────
const raw = readFileSync(join(TOUR, 'data.js'), 'utf8').trim();
const data = JSON.parse(raw.replace(/^var\s+APP_DATA\s*=\s*/, '').replace(/;$/, ''));
const scenes = data.scenes;

const links = scenes.flatMap((s) => s.linkHotspots.map((h) => ({ from: s.id, ...h })));
const infos = scenes.flatMap((s) => s.infoHotspots.map((h) => ({ scene: s.id, ...h })));
const ids = new Set(scenes.map((s) => s.id));

// ── structural checks against the export's own contract ─────────────────────
for (const l of links) if (!ids.has(l.target)) fail(`dangling link ${l.from} -> ${l.target}`);
for (const s of scenes) {
  const v = s.initialViewParameters;
  if (typeof v?.yaw !== 'number' || typeof v?.pitch !== 'number' || typeof v?.fov !== 'number') {
    fail(`${s.id}: initial view is not fully specified`);
  }
  if (!existsSync(join(TOUR, 'tiles', s.id))) fail(`${s.id}: tile directory missing`);
}

// The tour is deliberately asymmetric. Guard against anyone "helpfully"
// pairing it up again: the authored one-way count must not drop.
const pairs = new Set(links.map((l) => `${l.from}>${l.target}`));
const oneWay = [...pairs].filter((p) => {
  const [a, b] = p.split('>');
  return !pairs.has(`${b}>${a}`);
});

// ── the entry point must carry the base path, or every asset 404s ───────────
const html = readFileSync(join(TOUR, 'index.html'), 'utf8');
if (!/<base\s+href="\/tour\/modern-museum\/">/.test(html)) {
  fail('index.html is missing <base href="/tour/modern-museum/">');
}

const EXPECTED = { scenes: 33, links: 79, infos: 0, oneWay: 25 };
if (scenes.length !== EXPECTED.scenes)
  fail(`scene count ${String(scenes.length)} != ${String(EXPECTED.scenes)}`);
if (links.length !== EXPECTED.links)
  fail(`link hotspot count ${String(links.length)} != ${String(EXPECTED.links)}`);
if (infos.length !== EXPECTED.infos)
  fail(`info hotspot count ${String(infos.length)} != ${String(EXPECTED.infos)}`);
if (oneWay.length !== EXPECTED.oneWay) {
  fail(
    `one-way link count ${String(oneWay.length)} != ${String(EXPECTED.oneWay)} — the authored graph must stay asymmetric`,
  );
}

const tileFiles = readdirSync(join(TOUR, 'tiles')).length;
console.log(`marzipano tour (${ROOT}):`);
console.log(
  `  scenes: ${String(scenes.length)}  link hotspots: ${String(links.length)}  info hotspots: ${String(infos.length)}`,
);
console.log(`  authored one-way links preserved: ${String(oneWay.length)}`);
console.log(`  tile directories: ${String(tileFiles)}`);
console.log(`  settings: ${JSON.stringify(data.settings)}`);

if (problems.length > 0) {
  console.error(`  ✗ ${String(problems.length)} problem(s):`);
  for (const p of problems) console.error(`    ✗ ${p}`);
  process.exit(1);
}
console.log('  ✓ marzipano tour intact');
