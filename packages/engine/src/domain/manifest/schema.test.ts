import { describe, expect, it } from 'vitest';
import { makeProject } from './manifest.fixture.ts';
import { parseProjectManifest } from './schema.ts';

/** Clone-and-mutate helper: JSON round-trip is fine for plain manifest data. */
function broken(mutate: (p: ReturnType<typeof makeProject>) => void): unknown {
  const project = JSON.parse(JSON.stringify(makeProject())) as ReturnType<typeof makeProject>;
  mutate(project);
  return project;
}

const firstPano = (p: ReturnType<typeof makeProject>) =>
  p.buildings[0]!.floors[0]!.rooms[0]!.panoramas[0]!;

describe('projectManifestSchema (seeded defects)', () => {
  it('accepts the valid baseline', () => {
    expect(parseProjectManifest(makeProject()).ok).toBe(true);
  });

  it.each([
    [
      'wrong formatVersion',
      broken((p) => {
        (p as { formatVersion: number }).formatVersion = 2;
      }),
      /formatVersion/,
    ],
    [
      'non-kebab-case id',
      broken((p) => {
        p.id = 'Test Project!';
      }),
      /slug/,
    ],
    [
      'missing panorama description (accessibility text)',
      broken((p) => {
        firstPano(p).description = '  ';
      }),
      /description is required/,
    ],
    [
      'missing poster alt text',
      broken((p) => {
        firstPano(p).posterAlt = '';
      }),
      /alt text is required/,
    ],
    [
      'empty hotspot label',
      broken((p) => {
        firstPano(p).hotspots[0]!.label = '';
      }),
      /hotspot label is required/,
    ],
    [
      'yaw out of range',
      broken((p) => {
        firstPano(p).initialView.yaw = 270;
      }),
      /yaw/,
    ],
    [
      'fov out of range',
      broken((p) => {
        firstPano(p).initialView.fov = 10;
      }),
      /fov/,
    ],
    [
      'link hotspot without arrivalView',
      broken((p) => {
        // @ts-expect-error seeding a structural defect
        delete firstPano(p).hotspots[0].arrivalView;
      }),
      /arrivalView/,
    ],
    [
      'invalid tile version hash',
      broken((p) => {
        firstPano(p).tiles.version = 'NOT-A-HASH';
      }),
      /hex content hash/,
    ],
    [
      'faceSize not a power-of-two multiple of tileSize',
      broken((p) => {
        firstPano(p).tiles.faceSize = 1536;
      }),
      /power of two/,
    ],
    [
      'faceSize not a whole multiple of tileSize',
      broken((p) => {
        firstPano(p).tiles.faceSize = 768;
      }),
      /power of two/,
    ],
    [
      'wrong tile size',
      broken((p) => {
        (firstPano(p).tiles as { tileSize: number }).tileSize = 256;
      }),
      /tileSize/,
    ],
    [
      'empty buildings',
      broken((p) => {
        p.buildings = [] as never;
      }),
      /buildings/,
    ],
    [
      'building without floors',
      broken((p) => {
        p.buildings[1]!.floors = [] as never;
      }),
      /floors/,
    ],
    [
      'unknown projection',
      broken((p) => {
        (firstPano(p).tiles as { projection: string }).projection = 'equirect';
      }),
      /projection/,
    ],
  ])('rejects: %s', (_name, data, pattern) => {
    const result = parseProjectManifest(data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.join('\n')).toMatch(pattern);
    }
  });

  it('reports all defects at once, not first-failure (contract §8)', () => {
    const data = broken((p) => {
      p.title = '';
      p.description = '';
      firstPano(p).posterAlt = '';
    });
    const result = parseProjectManifest(data);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('issue strings carry the field path', () => {
    const result = parseProjectManifest(
      broken((p) => {
        firstPano(p).posterAlt = '';
      }),
    );
    if (!result.ok) {
      expect(result.issues[0]).toContain('buildings.0.floors.0.rooms.0.panoramas.0.posterAlt');
    }
  });
});
