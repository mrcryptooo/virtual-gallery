/**
 * Test helper: a minimal VALID manifest builder. Tests clone and break it to
 * seed defects — every test starts from a known-green baseline.
 */
import type { Panorama, ProjectManifest } from './schema.ts';

export const validTiles = {
  projection: 'cube',
  version: 'abcd1234',
  tileSize: 512,
  faceSize: 1024,
  previewSize: 256,
  formats: ['png'],
} satisfies Panorama['tiles'];

export function makePanorama(id: string, targets: string[] = []): Panorama {
  return {
    id,
    name: `Panorama ${id}`,
    description: `Description of ${id}.`,
    posterAlt: `Poster of ${id}.`,
    initialView: { yaw: 0, pitch: 0, fov: 90 },
    tiles: { ...validTiles, formats: ['png'] },
    hotspots: targets.map((target) => ({
      type: 'link' as const,
      yaw: 10,
      pitch: -5,
      label: `Go to ${target}`,
      target,
      arrivalView: { yaw: 0, pitch: 0, fov: 90 },
    })),
  };
}

/**
 * Two buildings, two floors in the first, one room per floor:
 *   a (entrance) ↔ b, b → c (cross-floor), a → d (cross-building)
 */
export function makeProject(): ProjectManifest {
  return {
    formatVersion: 1,
    id: 'test-project',
    title: 'Test Project',
    description: 'A valid baseline project.',
    entrancePanorama: 'pano-a',
    coverPanorama: 'pano-a',
    buildings: [
      {
        id: 'building-one',
        name: 'Building One',
        floors: [
          {
            id: 'ground',
            name: 'Ground Floor',
            rooms: [
              {
                id: 'lobby',
                name: 'Lobby',
                panoramas: [
                  makePanorama('pano-a', ['pano-b', 'pano-d']),
                  makePanorama('pano-b', ['pano-a', 'pano-c']),
                ],
              },
            ],
          },
          {
            id: 'upper',
            name: 'Upper Floor',
            rooms: [
              {
                id: 'gallery',
                name: 'Gallery',
                panoramas: [makePanorama('pano-c', ['pano-b'])],
              },
            ],
          },
        ],
      },
      {
        id: 'building-two',
        name: 'Building Two',
        floors: [
          {
            id: 'ground',
            name: 'Ground Floor',
            rooms: [
              {
                id: 'court',
                name: 'Courtyard',
                panoramas: [makePanorama('pano-d', ['pano-a'])],
              },
            ],
          },
        ],
      },
    ],
  };
}
