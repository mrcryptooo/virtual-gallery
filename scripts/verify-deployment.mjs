/**
 * Post-deploy verification (contract §20): prove that every published project
 * package is actually being served — manifest, a preview tile, a deep tile and
 * a poster — not just that the SPA shell responds.
 *
 * The SPA fallback rewrite returns index.html with a 200 for unknown paths, so
 * a bare status check proves nothing. Every asset here is content-type checked.
 *
 *   node scripts/verify-deployment.mjs <baseUrl> [slug ...]
 */

const [, , baseUrl, ...slugArgs] = process.argv;
// modern-museum is served as a static Marzipano export, not an engine-rendered
// project package, so it has no /projects/<slug>/project.json manifest to
// check here — it is covered separately by verify-marzipano-deploy.mjs.
const slugs = slugArgs.length > 0 ? slugArgs : ['museum-test'];

if (baseUrl === undefined) {
  console.error('Usage: node scripts/verify-deployment.mjs <baseUrl> [slug ...]');
  process.exit(1);
}

const failures = [];
const ok = (message) => console.log(`  ✓ ${message}`);
const fail = (message) => {
  failures.push(message);
  console.error(`  ✗ ${message}`);
};

async function head(url, expectType) {
  const response = await fetch(url);
  const type = response.headers.get('content-type') ?? '';
  if (!response.ok) return `HTTP ${String(response.status)} for ${url}`;
  if (expectType !== undefined && !type.includes(expectType)) {
    // A rewrite served HTML in place of a real asset — the failure mode a
    // plain status check would miss entirely.
    return `expected ${expectType} but got "${type}" for ${url}`;
  }
  return null;
}

console.log(`Verifying ${baseUrl}`);

for (const slug of slugs) {
  console.log(`\n${slug}`);

  const routeError = await head(`${baseUrl}/p/${slug}`, 'text/html');
  if (routeError) fail(routeError);
  else ok(`route /p/${slug} serves the app shell`);

  const manifestUrl = `${baseUrl}/projects/${slug}/project.json`;
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) {
    fail(`HTTP ${String(manifestResponse.status)} for ${manifestUrl}`);
    continue;
  }
  let manifest;
  try {
    manifest = await manifestResponse.json();
  } catch {
    fail(`${manifestUrl} did not return JSON (SPA fallback served instead?)`);
    continue;
  }

  const panoramas = manifest.buildings.flatMap((b) =>
    b.floors.flatMap((f) => f.rooms.flatMap((r) => r.panoramas)),
  );
  ok(`manifest served: "${manifest.title}", ${String(panoramas.length)} panoramas`);

  // Spot-check the first and last panorama so one stale upload can't hide.
  for (const panorama of [panoramas[0], panoramas[panoramas.length - 1]]) {
    const { version, faceSize, tileSize, formats } = panorama.tiles;
    const format = formats[0];
    const deepest = String(faceSize);
    const lastTile = String(Math.ceil(faceSize / tileSize) - 1);
    const checks = [
      [
        `${baseUrl}/projects/${slug}/tiles/${panorama.id}/${version}/preview/front.${format}`,
        'image/',
      ],
      [
        `${baseUrl}/projects/${slug}/tiles/${panorama.id}/${version}/${deepest}/front/${lastTile}_${lastTile}.${format}`,
        'image/',
      ],
      [`${baseUrl}/projects/${slug}/posters/${panorama.id}.png`, 'image/'],
    ];
    let bad = 0;
    for (const [url, type] of checks) {
      const error = await head(url, type);
      if (error) {
        fail(error);
        bad += 1;
      }
    }
    if (bad === 0) ok(`${panorama.id}: preview, deepest tile and poster all served`);
  }
}

console.log('');
if (failures.length > 0) {
  console.error(`Deployment verification FAILED with ${String(failures.length)} problem(s).`);
  process.exit(1);
}
console.log(`Deployment verification OK — ${String(slugs.length)} package(s) fully served.`);
