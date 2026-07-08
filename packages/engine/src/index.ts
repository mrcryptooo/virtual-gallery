/**
 * @virtual-gallery/engine — public API surface.
 *
 * This file is the ONLY entry point clients may import (doc 03 rule 1).
 * The engine facade (`createPanoramaEngine`) lands in milestone M1.2.
 *
 * As of M0.4 the package exposes the engine's first public contract: the
 * project-manifest schema, its invariants, hierarchy indexes, and the
 * package path scheme (ADR-010, doc 02 §4).
 */

/** Package identity, used by clients to verify workspace wiring. */
export const ENGINE_NAME = '@virtual-gallery/engine';

/** Engine version; kept in lockstep with package.json once the facade lands (M1.2). */
export const ENGINE_VERSION = '0.0.0';

export {
  PACKAGE_FORMAT_VERSION,
  CUBE_FACES,
  projectManifestSchema,
  parseProjectManifest,
  type ParseResult,
  type CubeFace,
  type ProjectManifest,
  type Building,
  type Floor,
  type Room,
  type Panorama,
  type Hotspot,
  type LinkHotspot,
  type InfoHotspot,
  type View,
  type TilesMeta,
  type TileFormat,
} from './domain/manifest/schema.ts';

export { validateProjectInvariants } from './domain/manifest/invariants.ts';

export {
  buildProjectIndex,
  type ProjectIndex,
  type PanoramaLocation,
} from './domain/manifest/indexes.ts';

export {
  levelFaceSizes,
  tilesPerAxis,
  tilePath,
  previewPath,
  posterPath,
  thumbPath,
  expectedPanoramaFiles,
  expectedPackageFiles,
} from './domain/manifest/paths.ts';
