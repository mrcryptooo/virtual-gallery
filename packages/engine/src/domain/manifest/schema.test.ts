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

  it('accepts the RESERVED hotspot types (media, external) without v1 semantics', () => {
    const data = broken((p) => {
      firstPano(p).hotspots.push(
        {
          type: 'external',
          yaw: 0,
          pitch: 0,
          label: 'Product page',
          url: 'https://example.com/product',
        },
        {
          type: 'media',
          yaw: 10,
          pitch: 0,
          label: 'Ambience recording',
          media: { kind: 'audio', src: 'media/ambience.opus' },
        },
      );
    });
    expect(parseProjectManifest(data).ok).toBe(true);
  });

  it('accepts full panorama metadata (tags, thumbnail, dates, poster override)', () => {
    const data = broken((p) => {
      const pano = firstPano(p);
      pano.tags = ['lobby', 'daylight'];
      pano.thumbnail = { src: 'posters/custom-thumb.png', alt: 'Custom thumb' };
      pano.poster.src = 'posters/custom-poster.png';
      pano.createdAt = '2026-07-01';
      pano.updatedAt = '2026-07-09T12:30:00Z';
    });
    expect(parseProjectManifest(data).ok).toBe(true);
  });

  it.each([
    [
      'malformed schemaVersion (not semver)',
      broken((p) => {
        (p as { schemaVersion: string }).schemaVersion = '1.0';
      }),
      /semantic version/,
    ],
    [
      'unsupported schemaVersion major',
      broken((p) => {
        (p as { schemaVersion: string }).schemaVersion = '2.0.0';
      }),
      /unsupported schemaVersion major/,
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
        firstPano(p).poster.alt = '';
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
      'unknown hotspot type',
      broken((p) => {
        (firstPano(p).hotspots[0] as { type: string }).type = 'teleport';
      }),
      /type/,
    ],
    [
      'external hotspot with invalid url',
      broken((p) => {
        firstPano(p).hotspots.push({
          type: 'external',
          yaw: 0,
          pitch: 0,
          label: 'Broken',
          url: 'not-a-url',
        });
      }),
      /url/i,
    ],
    [
      'media hotspot with path traversal',
      broken((p) => {
        firstPano(p).hotspots.push({
          type: 'media',
          yaw: 0,
          pitch: 0,
          label: 'Escape attempt',
          media: { kind: 'image', src: '../outside.png' },
        });
      }),
      /package-relative/,
    ],
    [
      'poster override with an absolute path',
      broken((p) => {
        firstPano(p).poster.src = '/etc/anything.png';
      }),
      /package-relative/,
    ],
    [
      'invalid createdAt date',
      broken((p) => {
        firstPano(p).createdAt = '09.07.2026';
      }),
      /ISO 8601/,
    ],
    [
      'invalid metadata website url',
      broken((p) => {
        p.metadata = { ...p.metadata, website: 'not a url' };
      }),
      /url/i,
    ],
    [
      'metadata year out of range',
      broken((p) => {
        p.metadata = { ...p.metadata, year: 1500 };
      }),
      /year/,
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
      'navigation hotspot without arrivalView',
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
      firstPano(p).poster.alt = '';
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
        firstPano(p).poster.alt = '';
      }),
    );
    if (!result.ok) {
      expect(result.issues[0]).toContain('buildings.0.floors.0.rooms.0.panoramas.0.poster.alt');
    }
  });
});
