import { describe, expect, it } from 'vitest';
import { buildProjectIndex } from './indexes.ts';
import { makeProject } from './manifest.fixture.ts';

describe('buildProjectIndex', () => {
  const index = buildProjectIndex(makeProject());

  it('lists all panorama ids in authored order', () => {
    expect(index.panoramaIds).toEqual(['pano-a', 'pano-b', 'pano-c', 'pano-d']);
  });

  it('returns panoramas by id', () => {
    expect(index.getPanorama('pano-c')?.title).toBe('Panorama pano-c');
    expect(index.getPanorama('nope')).toBeUndefined();
  });

  it('reverse-locates a panorama to its building/floor/room (wayfinding, F8)', () => {
    const location = index.locate('pano-c');
    expect(location?.building.id).toBe('building-one');
    expect(location?.floor.id).toBe('upper');
    expect(location?.room.id).toBe('gallery');
    expect(location?.panorama.id).toBe('pano-c');
  });

  it('locates cross-building panoramas correctly', () => {
    const location = index.locate('pano-d');
    expect(location?.building.id).toBe('building-two');
    expect(location?.floor.id).toBe('ground');
  });

  it('returns undefined for unknown ids', () => {
    expect(index.locate('missing')).toBeUndefined();
  });
});
