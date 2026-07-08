/**
 * Cross-cutting manifest invariants (ADR-010) that field-level schema rules
 * cannot express: id uniqueness, reference resolution, and link-graph
 * connectivity. Pure — no I/O; file existence is the validator script's job.
 * Reports every violation at once (contract §8).
 */
import type { ProjectManifest } from './schema.ts';

export function validateProjectInvariants(project: ProjectManifest): readonly string[] {
  const issues: string[] = [];

  // ── Id uniqueness ──────────────────────────────────────────────────────────
  const duplicate = (kind: string, id: string, where: string) =>
    issues.push(`duplicate ${kind} id "${id}" in ${where}`);

  const buildingIds = new Set<string>();
  const panoramaIds = new Set<string>();

  for (const building of project.buildings) {
    if (buildingIds.has(building.id)) duplicate('building', building.id, `project ${project.id}`);
    buildingIds.add(building.id);

    const floorIds = new Set<string>();
    for (const floor of building.floors) {
      if (floorIds.has(floor.id)) duplicate('floor', floor.id, `building ${building.id}`);
      floorIds.add(floor.id);

      const roomIds = new Set<string>();
      for (const room of floor.rooms) {
        if (roomIds.has(room.id)) duplicate('room', room.id, `floor ${floor.id}`);
        roomIds.add(room.id);

        for (const panorama of room.panoramas) {
          // Panorama ids are project-unique — flat namespace for links/URLs (doc 01 §3.1)
          if (panoramaIds.has(panorama.id)) {
            duplicate('panorama', panorama.id, `project ${project.id} (flat namespace)`);
          }
          panoramaIds.add(panorama.id);
        }
      }
    }
  }

  // ── Reference resolution ───────────────────────────────────────────────────
  if (!panoramaIds.has(project.entrancePanorama)) {
    issues.push(`entrancePanorama "${project.entrancePanorama}" does not exist`);
  }
  if (!panoramaIds.has(project.coverPanorama)) {
    issues.push(`coverPanorama "${project.coverPanorama}" does not exist`);
  }

  const links = new Map<string, string[]>();
  for (const building of project.buildings) {
    for (const floor of building.floors) {
      for (const room of floor.rooms) {
        for (const panorama of room.panoramas) {
          const targets: string[] = [];
          for (const hotspot of panorama.hotspots) {
            if (hotspot.type !== 'link') continue;
            if (hotspot.target === panorama.id) {
              issues.push(`panorama "${panorama.id}": link hotspot targets itself`);
            } else if (!panoramaIds.has(hotspot.target)) {
              issues.push(
                `panorama "${panorama.id}": link target "${hotspot.target}" does not exist`,
              );
            } else {
              targets.push(hotspot.target);
            }
          }
          links.set(panorama.id, targets);
        }
      }
    }
  }

  // ── Connectivity: every panorama reachable from the entrance (ADR-010) ─────
  if (panoramaIds.has(project.entrancePanorama)) {
    const reachable = new Set<string>([project.entrancePanorama]);
    const queue = [project.entrancePanorama];
    // for..of sees elements appended during iteration — this is the BFS frontier
    for (const current of queue) {
      // Defensive fallback: every panorama id is registered in `links` above,
      // so get() cannot miss — kept for type honesty, excluded from coverage.
      /* v8 ignore next */
      for (const target of links.get(current) ?? []) {
        if (!reachable.has(target)) {
          reachable.add(target);
          queue.push(target);
        }
      }
    }
    for (const id of panoramaIds) {
      if (!reachable.has(id)) {
        issues.push(`panorama "${id}" is unreachable from the entrance (orphan)`);
      }
    }
  }

  return issues;
}
