/**
 * Package path scheme (doc 02 §4 / contract §17) — the single definition used
 * by the pipeline (writer), the validator (checker), and the loader (reader):
 *
 *   tiles/<panorama-id>/<version>/<levelFaceSize>/<face>/<x>_<y>.<format>
 *   tiles/<panorama-id>/<version>/preview/<face>.<format>
 *   posters/<panorama-id>.<format>          posters/<panorama-id>-thumb.<format>
 *
 * The per-panorama content-hash <version> segment is the cache-busting
 * mechanism (ADR-012): re-rendered panoramas get new URLs; untouched ones
 * keep long-cached paths. All paths are relative to the package root.
 */
import { CUBE_FACES, type CubeFace, type Panorama, type ProjectManifest } from './schema.ts';

/** Face sizes of every resolution level, shallowest first (doc 07 §2 ladder). */
export function levelFaceSizes(tiles: Pick<Panorama['tiles'], 'tileSize' | 'faceSize'>): number[] {
  const sizes: number[] = [];
  for (let size = tiles.tileSize; size <= tiles.faceSize; size *= 2) {
    sizes.push(size);
  }
  return sizes;
}

/** Tiles per axis of one face at a given level face size. */
export function tilesPerAxis(levelFaceSize: number, tileSize: number): number {
  return Math.ceil(levelFaceSize / tileSize);
}

export function tilePath(
  panoramaId: string,
  tiles: Panorama['tiles'],
  levelFaceSize: number,
  face: CubeFace,
  x: number,
  y: number,
  format: string,
): string {
  return `tiles/${panoramaId}/${tiles.version}/${String(levelFaceSize)}/${face}/${String(x)}_${String(y)}.${format}`;
}

export function previewPath(
  panoramaId: string,
  tiles: Panorama['tiles'],
  face: CubeFace,
  format: string,
): string {
  return `tiles/${panoramaId}/${tiles.version}/preview/${face}.${format}`;
}

export function posterPath(panoramaId: string, format: string): string {
  return `posters/${panoramaId}.${format}`;
}

export function thumbPath(panoramaId: string, format: string): string {
  return `posters/${panoramaId}-thumb.${format}`;
}

/**
 * Every file a valid package must contain for one panorama, all formats,
 * all levels, all faces (used by the validator and the pipeline).
 */
export function expectedPanoramaFiles(panorama: Panorama): string[] {
  const files: string[] = [];
  for (const format of panorama.tiles.formats) {
    for (const levelSize of levelFaceSizes(panorama.tiles)) {
      const n = tilesPerAxis(levelSize, panorama.tiles.tileSize);
      for (const face of CUBE_FACES) {
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            files.push(tilePath(panorama.id, panorama.tiles, levelSize, face, x, y, format));
          }
        }
      }
    }
    for (const face of CUBE_FACES) {
      files.push(previewPath(panorama.id, panorama.tiles, face, format));
    }
    files.push(posterPath(panorama.id, format), thumbPath(panorama.id, format));
  }
  return files;
}

/** Every file a valid package must contain, project-wide (incl. optional assets). */
export function expectedPackageFiles(project: ProjectManifest): string[] {
  const files: string[] = [];
  for (const building of project.buildings) {
    for (const floor of building.floors) {
      if (floor.floorplan !== undefined) files.push(floor.floorplan);
      for (const room of floor.rooms) {
        for (const panorama of room.panoramas) {
          files.push(...expectedPanoramaFiles(panorama));
          // Explicit poster/thumbnail overrides must exist like any other asset
          if (panorama.poster.src !== undefined) files.push(panorama.poster.src);
          if (panorama.thumbnail !== undefined) files.push(panorama.thumbnail.src);
          for (const hotspot of panorama.hotspots) {
            if (hotspot.type === 'information' && hotspot.image !== undefined) {
              files.push(hotspot.image);
            }
            // Reserved type: contract-accepted, so its asset is contract-checked
            if (hotspot.type === 'media') {
              files.push(hotspot.media.src);
            }
          }
        }
      }
    }
  }
  return files;
}
