/**
 * Content validation gate (ADR-010, doc 12 M0.4) — validates every project
 * package found in the content locations:
 *
 *   1. project.json parses and passes the schema (all issues at once)
 *   2. cross-cutting invariants: id uniqueness, hotspot resolution,
 *      entrance/cover references, link-graph connectivity (no orphans)
 *   3. every expected file exists (tiles, previews, posters, thumbs,
 *      floorplans, info images) per the canonical path scheme
 *   4. the package folder name matches the manifest id (discovery contract)
 *
 * Usage: node scripts/validate-packages.ts [dir ...]
 * Defaults: apps/portfolio/public/projects + packages/engine/test/fixtures.
 * Requires Node ≥ 22.18 (native type stripping). Exit 1 on any violation;
 * reporting is exhaustive, not first-failure (contract §8).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import {
  expectedPackageFiles,
  parseProjectManifest,
  validateProjectInvariants,
} from '@virtual-gallery/engine';

const DEFAULT_DIRS = ['apps/portfolio/public/projects', 'packages/engine/test/fixtures'];
const dirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_DIRS;

let packagesChecked = 0;
const failures: string[] = [];
const fail = (pkg: string, message: string) => failures.push(`${pkg}: ${message}`);

for (const dir of dirs) {
  if (!existsSync(dir)) continue;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = join(dir, entry.name);
    const manifestPath = join(packageDir, 'project.json');
    if (!existsSync(manifestPath)) continue; // not a package folder

    packagesChecked++;
    const pkg = entry.name;

    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(manifestPath, 'utf8'));
    } catch (error) {
      fail(pkg, `project.json is not valid JSON (${String(error)})`);
      continue;
    }

    const parsed = parseProjectManifest(raw);
    if (!parsed.ok) {
      for (const issue of parsed.issues) fail(pkg, `schema: ${issue}`);
      continue; // structural failure — later gates would only cascade noise
    }

    if (parsed.project.id !== basename(packageDir)) {
      fail(pkg, `folder name must equal manifest id "${parsed.project.id}" (discovery contract)`);
    }

    for (const issue of validateProjectInvariants(parsed.project)) {
      fail(pkg, `invariant: ${issue}`);
    }

    let missing = 0;
    for (const relPath of expectedPackageFiles(parsed.project)) {
      if (!existsSync(join(packageDir, relPath))) {
        missing++;
        if (missing <= 20) fail(pkg, `missing file: ${relPath}`);
      }
    }
    if (missing > 20) fail(pkg, `…and ${String(missing - 20)} more missing files`);
  }
}

if (failures.length > 0) {
  console.error(`[pipeline] validate-packages: ${String(failures.length)} violation(s):\n`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  console.error(
    '\n  Packages are pipeline output — fix content in content-src/ and re-run the pipeline; never hand-edit a package (doc 03 rule 3).',
  );
  process.exit(1);
}

console.log(
  `[pipeline] validate-packages: OK — ${String(packagesChecked)} package(s) valid across ${String(dirs.length)} location(s).`,
);
