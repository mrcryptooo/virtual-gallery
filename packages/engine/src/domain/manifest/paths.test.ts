import { describe, expect, it } from 'vitest';
import { makePanorama, makeProject } from './manifest.fixture.ts';
import {
  expectedPackageFiles,
  expectedPanoramaFiles,
  levelFaceSizes,
  posterPath,
  previewPath,
  thumbPath,
  tilePath,
  tilesPerAxis,
} from './paths.ts';

describe('package path scheme (contract §17)', () => {
  const pano = makePanorama('pano-a');

  it('derives the level ladder from faceSize', () => {
    expect(levelFaceSizes({ tileSize: 512, faceSize: 512 })).toEqual([512]);
    expect(levelFaceSizes({ tileSize: 512, faceSize: 1024 })).toEqual([512, 1024]);
    expect(levelFaceSizes({ tileSize: 512, faceSize: 4096 })).toEqual([512, 1024, 2048, 4096]);
  });

  it('computes tiles per axis', () => {
    expect(tilesPerAxis(512, 512)).toBe(1);
    expect(tilesPerAxis(1024, 512)).toBe(2);
    expect(tilesPerAxis(4096, 512)).toBe(8);
  });

  it('builds the canonical tile, preview, and poster paths', () => {
    expect(tilePath('pano-a', pano.tiles, 1024, 'front', 1, 0, 'png')).toBe(
      'tiles/pano-a/abcd1234/1024/front/1_0.png',
    );
    expect(previewPath('pano-a', pano.tiles, 'down', 'png')).toBe(
      'tiles/pano-a/abcd1234/preview/down.png',
    );
    expect(posterPath('pano-a', 'png')).toBe('posters/pano-a.png');
    expect(thumbPath('pano-a', 'png')).toBe('posters/pano-a-thumb.png');
  });

  it('enumerates the complete expected file set for a panorama', () => {
    // faceSize 1024 → level 512 (1 tile/face) + level 1024 (4 tiles/face)
    // = 6×(1+4) tiles + 6 previews + poster + thumb = 38 files in one format
    const files = expectedPanoramaFiles(pano);
    expect(files).toHaveLength(38);
    expect(new Set(files).size).toBe(38); // no duplicates
    expect(files).toContain('tiles/pano-a/abcd1234/1024/up/1_1.png');
    expect(files).toContain('tiles/pano-a/abcd1234/preview/front.png');
    expect(files).toContain('posters/pano-a-thumb.png');
  });

  it('scales with formats', () => {
    const twoFormat = makePanorama('pano-a');
    twoFormat.tiles.formats = ['avif', 'webp'];
    expect(expectedPanoramaFiles(twoFormat)).toHaveLength(76);
  });

  it('includes optional floorplans and info-hotspot images project-wide', () => {
    const project = makeProject();
    project.buildings[0]!.floors[0]!.floorplan = 'plans/ground.png';
    project.buildings[0]!.floors[0]!.rooms[0]!.panoramas[0]!.hotspots.push({
      type: 'info',
      yaw: 0,
      pitch: 0,
      label: 'About the facade',
      title: 'Facade',
      body: 'Materials.',
      image: 'info/facade.png',
    });
    const files = expectedPackageFiles(project);
    expect(files).toContain('plans/ground.png');
    expect(files).toContain('info/facade.png');
    expect(files).toHaveLength(4 * 38 + 2);
  });
});
