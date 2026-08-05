/**
 * Navigation-graph gate (owner requirement, 2026-08-05). Walks a published
 * project package in both directions and proves the tour is navigable:
 *
 *   • every navigation target exists            • no self-links
 *   • no dangling links                         • no duplicate hotspots
 *   • every scene reachable from the entrance   • no scene traps the visitor
 *   • every route reversible (directly, or by a path back)
 *   • every non-detail scene offers onward navigation
 *   • every detail/zoom scene has a return route
 *   • arrival views land on a real view of the destination
 *
 *   node scripts/validate-graph.mjs [slug ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const slugs = process.argv.slice(2);
if (slugs.length === 0) slugs.push('modern-museum');

let failed = false;

for (const slug of slugs) {
  const path = join('apps', 'portfolio', 'public', 'projects', slug, 'project.json');
  const project = JSON.parse(readFileSync(path, 'utf8'));
  const panoramas = project.buildings.flatMap((b) =>
    b.floors.flatMap((f) => f.rooms.flatMap((r) => r.panoramas)),
  );
  const byId = new Map(panoramas.map((p) => [p.id, p]));
  const nav = (p) => p.hotspots.filter((h) => h.type === 'navigation');
  const problems = [];
  const notes = [];

  // ── structural integrity ──────────────────────────────────────────────────
  for (const p of panoramas) {
    const seen = new Set();
    for (const h of nav(p)) {
      if (!byId.has(h.target)) problems.push(`${p.id}: dangling link to "${h.target}"`);
      if (h.target === p.id) problems.push(`${p.id}: self-link`);
      if (seen.has(h.target)) problems.push(`${p.id}: duplicate hotspot to "${h.target}"`);
      seen.add(h.target);
      if (!h.label?.trim()) problems.push(`${p.id}: navigation hotspot without a label`);
      // arrival view must be a real view of the destination
      const target = byId.get(h.target);
      if (target) {
        const a = h.arrivalView;
        if (!a || Math.abs(a.yaw) > 180 || Math.abs(a.pitch) > 90 || a.fov < 30 || a.fov > 120) {
          problems.push(`${p.id} -> ${h.target}: arrival view out of range`);
        }
      }
      // two hotspots must not sit on top of each other
      for (const other of nav(p)) {
        if (other === h) continue;
        const dy = Math.abs(((h.yaw - other.yaw + 540) % 360) - 180);
        if (dy < 6 && Math.abs(h.pitch - other.pitch) < 6) {
          problems.push(`${p.id}: hotspots to "${h.target}" and "${other.target}" overlap`);
        }
      }
    }
  }

  // ── reachability from the entrance, forwards ──────────────────────────────
  const walk = (start, edges) => {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      for (const next of edges(queue.shift())) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };
  const forward = (id) => nav(byId.get(id) ?? { hotspots: [] }).map((h) => h.target);
  const reverseIndex = new Map(panoramas.map((p) => [p.id, []]));
  for (const p of panoramas) for (const h of nav(p)) reverseIndex.get(h.target)?.push(p.id);
  const backward = (id) => reverseIndex.get(id) ?? [];

  const reachable = walk(project.entrancePanorama, forward);
  for (const p of panoramas) {
    if (!reachable.has(p.id)) problems.push(`${p.id}: unreachable from the entrance`);
  }

  // ── no traps: every scene must get back to the entrance ───────────────────
  const canReturn = walk(project.entrancePanorama, backward);
  for (const p of panoramas) {
    if (!canReturn.has(p.id))
      problems.push(`${p.id}: traps the visitor (no path back to the entrance)`);
  }

  // ── reversibility of every route ──────────────────────────────────────────
  const oneWay = [];
  for (const p of panoramas) {
    for (const h of nav(p)) {
      const target = byId.get(h.target);
      if (!target) continue;
      const direct = nav(target).some((x) => x.target === p.id);
      if (direct) continue;
      // no direct reverse: a path back must exist, otherwise it is a trap
      const back = walk(h.target, forward);
      if (!back.has(p.id))
        problems.push(`${p.id} -> ${h.target}: no reverse route and no path back`);
      else oneWay.push(`${p.id} -> ${h.target}`);
    }
  }

  // ── onward navigation / detail returns ────────────────────────────────────
  for (const p of panoramas) {
    const out = nav(p);
    if (out.length === 0) problems.push(`${p.id}: no onward navigation (dead end)`);
    if (out.length === 1) notes.push(`${p.id}: detail scene, single return -> ${out[0].target}`);
  }

  console.log(
    `\n${slug}: ${String(panoramas.length)} panoramas, ` +
      `${String(panoramas.reduce((n, p) => n + nav(p).length, 0))} navigation edges`,
  );
  console.log(`  reachable from entrance: ${String(reachable.size)}/${String(panoramas.length)}`);
  console.log(`  can return to entrance:  ${String(canReturn.size)}/${String(panoramas.length)}`);
  console.log(`  detail scenes (1 exit):  ${String(notes.length)}`);
  if (oneWay.length > 0) {
    console.log(`  intentional one-way jump cuts (path back verified): ${String(oneWay.length)}`);
    for (const o of oneWay) console.log(`    · ${o}`);
  }
  if (problems.length > 0) {
    failed = true;
    console.error(`  ✗ ${String(problems.length)} problem(s):`);
    for (const p of problems) console.error(`    ✗ ${p}`);
  } else {
    console.log('  ✓ graph valid');
  }
}

if (failed) process.exit(1);
console.log('\n[pipeline] validate-graph: OK');
