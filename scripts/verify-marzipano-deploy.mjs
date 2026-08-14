/**
 * Production check for the Marzipano tour.
 *
 * The SPA fallback answers unknown paths with index.html and a 200, so a status
 * code alone proves nothing: every asset here is content-type checked, and HTML
 * coming back for a .js/.png request is treated as a failure.
 *
 *   node scripts/verify-marzipano-deploy.mjs <baseUrl>
 */
const baseUrl = process.argv[2];
if (!baseUrl) {
  console.error('Usage: node scripts/verify-marzipano-deploy.mjs <baseUrl>');
  process.exit(1);
}

const TOUR = `${baseUrl}/tour/modern-museum`;
const failures = [];
const ok = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => {
  failures.push(m);
  console.error(`  ✗ ${m}`);
};

async function check(url, expectType, label) {
  const res = await fetch(url);
  const type = (res.headers.get('content-type') ?? '').split(';')[0];
  if (!res.ok) return bad(`${String(res.status)} ${label} (${url})`);
  if (!type.includes(expectType))
    return bad(`${label}: expected ${expectType}, got "${type}" — SPA fallback? (${url})`);
  ok(`${label} [${type}]`);
  return res;
}

console.log(`Verifying Marzipano tour at ${baseUrl}\n`);

// the public route itself must serve the tour, not the SPA shell
const routeRes = await fetch(`${baseUrl}/p/modern-museum`);
const html = await routeRes.text();
if (!routeRes.ok) bad(`/p/modern-museum returned ${String(routeRes.status)}`);
else if (!html.includes('<base href="/tour/modern-museum/">'))
  bad('/p/modern-museum is not the Marzipano document');
else ok('/p/modern-museum serves the Marzipano document with its base path');

await check(`${TOUR}/data.js`, 'javascript', 'data.js');
await check(`${TOUR}/index.js`, 'javascript', 'index.js');
await check(`${TOUR}/style.css`, 'text/css', 'style.css');
await check(`${TOUR}/vendor/marzipano.js`, 'javascript', 'vendor/marzipano.js');
await check(`${TOUR}/vendor/screenfull.min.js`, 'javascript', 'vendor/screenfull.min.js');
await check(`${TOUR}/vendor/bowser.min.js`, 'javascript', 'vendor/bowser.min.js');
await check(`${TOUR}/vendor/reset.min.css`, 'text/css', 'vendor/reset.min.css');
await check(`${TOUR}/img/link.png`, 'image/', 'img/link.png');
await check(`${TOUR}/img/info.png`, 'image/', 'img/info.png');

// scene data drives the tile checks, so first and last scene are really exercised
const dataRes = await fetch(`${TOUR}/data.js`);
const data = JSON.parse(
  (await dataRes.text())
    .trim()
    .replace(/^var\s+APP_DATA\s*=\s*/, '')
    .replace(/;$/, ''),
);
const scenes = data.scenes;
console.log(`\n  scenes in production data.js: ${String(scenes.length)}`);

for (const scene of [scenes[0], scenes[scenes.length - 1]]) {
  // preview (fallback level), an early tile and a deep tile
  await check(`${TOUR}/tiles/${scene.id}/preview.jpg`, 'image/', `${scene.id} preview`);
  await check(`${TOUR}/tiles/${scene.id}/1/f/0/0.jpg`, 'image/', `${scene.id} level 1 tile`);
  await check(`${TOUR}/tiles/${scene.id}/3/f/3/3.jpg`, 'image/', `${scene.id} deep tile`);
}

// a path that does not exist must not masquerade as an asset
const ghost = await fetch(`${TOUR}/tiles/does-not-exist/1/f/0/0.jpg`);
const ghostType = (ghost.headers.get('content-type') ?? '').split(';')[0];
if (ghost.ok && ghostType.includes('html')) {
  bad(
    'a missing tile resolves to SPA HTML instead of 404 — Marzipano would decode HTML as an image',
  );
} else {
  ok(`missing asset returns ${String(ghost.status)} (no HTML masquerade)`);
}

console.log('');
if (failures.length > 0) {
  console.error(`Marzipano production verification FAILED: ${String(failures.length)} problem(s).`);
  process.exit(1);
}
console.log('Marzipano production verification OK.');
