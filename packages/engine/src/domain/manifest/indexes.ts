/**
 * Hierarchy indexes (doc 02 §2.2): O(1) panorama lookup and reverse lookup
 * (panorama → its building/floor/room) for wayfinding (F8). Built once per
 * loaded project; treat as immutable.
 */
import type { Building, Floor, Panorama, ProjectManifest, Room } from './schema.ts';

export interface PanoramaLocation {
  readonly building: Building;
  readonly floor: Floor;
  readonly room: Room;
  readonly panorama: Panorama;
}

export interface ProjectIndex {
  readonly project: ProjectManifest;
  /** All panorama ids in authored (walk) order. */
  readonly panoramaIds: readonly string[];
  getPanorama(id: string): Panorama | undefined;
  /** Reverse lookup for the wayfinding breadcrumb (doc 01 §3.1 elision happens in UI). */
  locate(id: string): PanoramaLocation | undefined;
}

export function buildProjectIndex(project: ProjectManifest): ProjectIndex {
  const locations = new Map<string, PanoramaLocation>();
  const panoramaIds: string[] = [];

  for (const building of project.buildings) {
    for (const floor of building.floors) {
      for (const room of floor.rooms) {
        for (const panorama of room.panoramas) {
          // Invariants guarantee uniqueness; first-write-wins keeps the index
          // deterministic even on invalid input.
          if (!locations.has(panorama.id)) {
            locations.set(panorama.id, { building, floor, room, panorama });
            panoramaIds.push(panorama.id);
          }
        }
      }
    }
  }

  return {
    project,
    panoramaIds,
    getPanorama: (id) => locations.get(id)?.panorama,
    locate: (id) => locations.get(id),
  };
}
