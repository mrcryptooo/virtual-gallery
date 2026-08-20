/**
 * Production deploy (ADR-001/ADR-012). One command, no manual steps:
 *
 *   pnpm deploy:prod
 *
 * What it guarantees, and why each part is not optional:
 *
 *  • Only built artifacts ship. We deploy `apps/portfolio/dist`, so panorama
 *    masters under content-src/ (hundreds of MB of pipeline input) can never
 *    be uploaded — they are not in the deployed tree at all.
 *  • `--archive=tgz` is baked in. A project package is thousands of small tile
 *    files; without an archive the upload trips Vercel's per-account file
 *    limit (`api-upload-free`, >5000 files/24h) and the deploy fails. Byte
 *    size is not the constraint — file count is — so this stays required even
 *    after the AVIF ladder lands (M0.6).
 *  • The existing Vercel project is reused. Deploying a directory called
 *    "dist" would otherwise create a stray project named after the folder, so
 *    the project linkage is copied into the artifact directory first.
 *  • Routing and cache headers come from the repo's vercel.json, minus the
 *    build fields that do not apply to a prebuilt upload.
 *  • The deploy is verified before the script reports success.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = join('apps', 'portfolio', 'dist');
const run = (command, args, options = {}) =>
  execFileSync(command, args, { encoding: 'utf8', shell: true, ...options });

// ── 1. Build ────────────────────────────────────────────────────────────────
console.log('[deploy] building the portfolio…');
run('pnpm', ['--filter', '@virtual-gallery/portfolio', 'build'], { stdio: 'inherit' });

const projectsDir = join(DIST, 'projects');
if (!existsSync(join(DIST, 'index.html')) || !existsSync(projectsDir)) {
  console.error(`[deploy] ${DIST} is missing index.html or projects/ — build failed?`);
  process.exit(1);
}

// ── 1b. Carry the serverless functions into the artifact ───────────────────
// The uploaded directory (DIST) *is* the deployment source, so Vercel's
// zero-config Functions detection only finds an `api/` folder if one exists
// inside it. Mirror the repo-root `api/` tree here, applying the same
// exclusions as .vercelignore (test files and vitest.config.ts are not
// route handlers and previously pushed the function count over the Hobby
// plan's 12-function limit).
console.log('[deploy] copying api/ into the artifact…');
const apiSrc = 'api';
const apiDest = join(DIST, 'api');
function copyApiDir(src, dest) {
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (entry.name === 'tsconfig.json' || entry.name === 'vitest.config.ts') continue;
    if (entry.name.endsWith('.test.ts')) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyApiDir(srcPath, destPath);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}
copyApiDir(apiSrc, apiDest);

// The uploaded directory has no package.json of its own, so without one
// Vercel's function bundler can't tell these are ESM modules (api/ imports
// use "type": "module" + explicit .js extensions on relative specifiers),
// and `npm install` below would have nothing telling it which runtime
// packages api/'s non-relative imports need installed. Carry only what the
// functions actually import at runtime (checked via grep, not copied
// wholesale): @supabase/supabase-js and @vercel/blob. This is not the
// whole repo-root manifest, which describes a pnpm workspace this artifact
// directory isn't part of.
const rootPkg = JSON.parse(readFileSync('package.json', 'utf8'));
writeFileSync(
  join(DIST, 'package.json'),
  `${JSON.stringify(
    {
      type: rootPkg.type,
      engines: rootPkg.engines,
      dependencies: {
        '@supabase/supabase-js': rootPkg.dependencies['@supabase/supabase-js'],
        '@vercel/blob': rootPkg.dependencies['@vercel/blob'],
      },
    },
    null,
    2,
  )}\n`,
);

// ── 2. Routing + headers for the prebuilt upload ────────────────────────────
const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
// This upload is already built. The linked Vercel project carries build
// settings from source-based deploys, so they are explicitly neutralised —
// otherwise Vercel tries to rebuild the artifact folder and fails looking for
// an output directory inside it.
config.framework = null;
// Not blanked like buildCommand: the api/ functions just copied in need
// their two runtime dependencies (@supabase/supabase-js, @vercel/blob)
// actually installed before Vercel's function bundler runs. There's no
// lockfile in this artifact directory, so plain npm install resolves them
// fresh rather than trying (and failing) to honor the workspace's pnpm
// lockfile, which doesn't apply to this synthetic package.json.
config.installCommand = 'npm install';
config.buildCommand = '';
config.outputDirectory = '.';
writeFileSync(join(DIST, 'vercel.json'), `${JSON.stringify(config, null, 2)}\n`);

// ── 3. Reuse the existing Vercel project ────────────────────────────────────
const linkage = join('.vercel', 'project.json');
const distLinkage = join(DIST, '.vercel');
if (existsSync(linkage)) {
  mkdirSync(distLinkage, { recursive: true });
  cpSync(linkage, join(distLinkage, 'project.json'));
} else if (process.env['VERCEL_PROJECT_ID'] && process.env['VERCEL_ORG_ID']) {
  mkdirSync(distLinkage, { recursive: true });
  writeFileSync(
    join(distLinkage, 'project.json'),
    JSON.stringify({
      projectId: process.env['VERCEL_PROJECT_ID'],
      orgId: process.env['VERCEL_ORG_ID'],
    }),
  );
} else {
  console.error(
    '[deploy] no Vercel project linkage found.\n' +
      '         Run `vercel link` once in this checkout, or set VERCEL_PROJECT_ID and VERCEL_ORG_ID.',
  );
  process.exit(1);
}

// ── 4. Deploy the artifact directory as a single archive ────────────────────
console.log('[deploy] uploading built artifacts (single archive)…');
const output = run('vercel', ['deploy', '--prod', '--yes', '--archive=tgz'], { cwd: DIST });
const deploymentUrl = [...output.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/g)]
  .map((m) => m[0])
  .pop();
if (deploymentUrl === undefined) {
  console.error('[deploy] could not determine the deployment URL from the CLI output:\n', output);
  process.exit(1);
}
console.log(`[deploy] deployment ready: ${deploymentUrl}`);

// ── 5. Verify what is actually served ───────────────────────────────────────
// Per-deployment URLs sit behind Vercel's SSO on this account and answer every
// request with an HTML login redirect, so verification must target the public
// production alias. `vercel inspect` prints the alias list on stderr, hence the
// explicit redirect — without it the lookup silently finds nothing.
let target = process.env['VG_PRODUCTION_URL'] ?? '';
if (target === '') {
  try {
    const inspected = run('vercel', ['inspect', deploymentUrl, '2>&1'], { stdio: 'pipe' });
    const aliases = [...inspected.matchAll(/https:\/\/[a-z0-9-]+\.vercel\.app/g)]
      .map((m) => m[0])
      .filter((url) => url !== deploymentUrl)
      .sort((a, b) => a.length - b.length);
    target = aliases[0] ?? deploymentUrl;
  } catch {
    target = deploymentUrl;
  }
}
if (target === deploymentUrl) {
  console.warn(
    '[deploy] no production alias found — verifying the deployment URL, which may be ' +
      'SSO-protected. Set VG_PRODUCTION_URL to the public alias to be sure.',
  );
}

console.log(`[deploy] verifying ${target}`);
run('node', ['scripts/verify-deployment.mjs', target], { stdio: 'inherit', cwd: process.cwd() });
run('node', ['scripts/verify-marzipano-deploy.mjs', target], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
console.log(`\n[deploy] done — live at ${target}`);
