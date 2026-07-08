/**
 * Project-manifest schema — THE content contract of the engine (ADR-010,
 * doc 02 §4), FINAL as of the owner-approved M0.4 revision. Shape follows
 * the frozen hierarchy of doc 01 §3.1:
 *
 *   Project → Building[] → Floor[] → Room[] → Panorama[]
 *
 * Panorama ids are project-unique (flat namespace for links and URLs); the
 * hierarchy above them is organizational. Angles are authored in DEGREES
 * (artist-friendly; the engine converts internally): yaw 0 = authored north,
 * positive clockwise, range ±180; pitch ±90 (up positive); fov 30–120.
 *
 * Hotspots are an extensible discriminated union on `type`:
 * `navigation` and `information` are implemented in v1; `media` and
 * `external` are RESERVED — the contract accepts them so future engine
 * versions can implement them without a schema break (owner decision,
 * 2026-07-09).
 *
 * Schema owns per-field shape rules; cross-cutting invariants (uniqueness,
 * reference resolution, connectivity) live in invariants.ts; file existence
 * is checked by scripts/validate-packages.ts against paths.ts.
 */
import { z } from 'zod';

/**
 * Semantic version of the manifest contract this engine release reads.
 * Same-major manifests are accepted (minor/patch additions are compatible).
 */
export const SCHEMA_VERSION = '1.0.0';
const SUPPORTED_SCHEMA_MAJOR = 1;

/** Cube-face names used in tile paths, in fixed order (contract §17). */
export const CUBE_FACES = ['front', 'right', 'back', 'left', 'up', 'down'] as const;
export type CubeFace = (typeof CUBE_FACES)[number];

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a kebab-case slug (stable once published — F7)');

const requiredText = (what: string) => z.string().trim().min(1, `${what} is required (ADR-010)`);

/** Package-relative asset path (no leading slash, no traversal). */
const relativePathSchema = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !p.includes('..'), {
    message: 'must be a package-relative path without traversal',
  });

/** ISO 8601 date (2026-07-09) or datetime (2026-07-09T12:00:00Z). */
const isoDateSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/,
    'must be an ISO 8601 date or datetime',
  );

const degrees = (min: number, max: number) => z.number().min(min).max(max);

export const viewSchema = z.object({
  /** Degrees, 0 = authored north, positive = clockwise, ±180. */
  yaw: degrees(-180, 180),
  /** Degrees, up positive, ±90 (runtime clamps softer — doc 10 §3). */
  pitch: degrees(-90, 90),
  /** Field of view in degrees. */
  fov: degrees(30, 120),
});
export type View = z.infer<typeof viewSchema>;

// ── Hotspots (extensible discriminated union) ────────────────────────────────

const hotspotBase = {
  yaw: degrees(-180, 180),
  pitch: degrees(-90, 90),
  /** Accessible name of the hotspot button (doc 09 §2). */
  label: requiredText('hotspot label'),
};

/** Street View-style movement to another panorama (v1 — implemented). */
export const navigationHotspotSchema = z.object({
  ...hotspotBase,
  type: z.literal('navigation'),
  /** Target panorama id — may cross rooms, floors, and buildings (doc 01 §3.1). */
  target: slugSchema,
  /** Authored arrival direction — the visitor lands facing something composed (doc 10 §4). */
  arrivalView: viewSchema,
});
export type NavigationHotspot = z.infer<typeof navigationHotspotSchema>;

/** In-scene commentary panel (v1 — implemented). */
export const informationHotspotSchema = z.object({
  ...hotspotBase,
  type: z.literal('information'),
  title: requiredText('information title'),
  body: requiredText('information body'),
  /** Optional illustration, path relative to the package root. */
  image: relativePathSchema.optional(),
});
export type InformationHotspot = z.infer<typeof informationHotspotSchema>;

/** RESERVED — embedded media point; no v1 runtime implementation. */
export const mediaHotspotSchema = z.object({
  ...hotspotBase,
  type: z.literal('media'),
  media: z.object({
    kind: z.enum(['image', 'video', 'audio']),
    /** Package-relative media file. */
    src: relativePathSchema,
    caption: z.string().min(1).optional(),
  }),
});
export type MediaHotspot = z.infer<typeof mediaHotspotSchema>;

/** RESERVED — outbound link; no v1 runtime implementation. */
export const externalHotspotSchema = z.object({
  ...hotspotBase,
  type: z.literal('external'),
  url: z.string().url(),
});
export type ExternalHotspot = z.infer<typeof externalHotspotSchema>;

export const hotspotSchema = z.discriminatedUnion('type', [
  navigationHotspotSchema,
  informationHotspotSchema,
  mediaHotspotSchema,
  externalHotspotSchema,
]);
export type Hotspot = z.infer<typeof hotspotSchema>;

/** Hotspot types the v1 engine actually renders and operates. */
export const IMPLEMENTED_HOTSPOT_TYPES = ['navigation', 'information'] as const;

// ── Tiles ────────────────────────────────────────────────────────────────────

export const tileFormatSchema = z.enum(['avif', 'webp', 'jpg', 'png']);
export type TileFormat = z.infer<typeof tileFormatSchema>;

export const tilesMetaSchema = z
  .object({
    /** v1 delivery projection (ADR-004); field exists so future projections stay representable. */
    projection: z.literal('cube'),
    /** Content hash of the source panorama — the cache-busting path segment (contract §17). */
    version: z.string().regex(/^[0-9a-f]{8,40}$/, 'must be a lowercase hex content hash'),
    /** Fixed 512-px tiles (doc 07 §2). */
    tileSize: z.literal(512),
    /** Cube-face edge in pixels at the deepest level; must be tileSize × 2^n. */
    faceSize: z.number().int().min(512),
    /** Fixed 256-px preview faces (doc 07 §3). */
    previewSize: z.literal(256),
    /** Encodings available for every tile/preview/poster of this panorama. */
    formats: z.array(tileFormatSchema).nonempty(),
  })
  .superRefine((tiles, ctx) => {
    const ratio = tiles.faceSize / tiles.tileSize;
    if (!Number.isInteger(ratio) || (ratio & (ratio - 1)) !== 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['faceSize'],
        message: `faceSize ${String(tiles.faceSize)} must be tileSize × a power of two (doc 07 §2 ladder)`,
      });
    }
  });
export type TilesMeta = z.infer<typeof tilesMetaSchema>;

// ── Hierarchy ────────────────────────────────────────────────────────────────

export const panoramaSchema = z.object({
  id: slugSchema,
  title: requiredText('panorama title'),
  /** Required — this is the accessibility text for the Space Index (doc 09 §1). */
  description: requiredText('panorama description'),
  /** Optional free-form tags (filtering/search, future UI). */
  tags: z.array(z.string().min(1)).optional(),
  poster: z.object({
    /** Required alt text for the poster still (ADR-010). */
    alt: requiredText('poster alt text'),
    /** Optional explicit path; when absent the canonical scheme applies (posters/<id>.<fmt>). */
    src: relativePathSchema.optional(),
  }),
  /** Optional explicit thumbnail override; canonical scheme applies when absent. */
  thumbnail: z
    .object({
      src: relativePathSchema,
      alt: z.string().min(1).optional(),
    })
    .optional(),
  /** ISO 8601 — when the source render was created / last re-rendered. */
  createdAt: isoDateSchema.optional(),
  updatedAt: isoDateSchema.optional(),
  initialView: viewSchema,
  tiles: tilesMetaSchema,
  hotspots: z.array(hotspotSchema),
});
export type Panorama = z.infer<typeof panoramaSchema>;

export const roomSchema = z.object({
  id: slugSchema,
  name: requiredText('room name'),
  description: z.string().optional(),
  panoramas: z.array(panoramaSchema).nonempty(),
});
export type Room = z.infer<typeof roomSchema>;

export const floorSchema = z.object({
  id: slugSchema,
  name: requiredText('floor name'),
  description: z.string().optional(),
  /** Optional floorplan image (v1.x F13), path relative to the package root. */
  floorplan: relativePathSchema.optional(),
  rooms: z.array(roomSchema).nonempty(),
});
export type Floor = z.infer<typeof floorSchema>;

export const buildingSchema = z.object({
  id: slugSchema,
  name: requiredText('building name'),
  description: z.string().optional(),
  floors: z.array(floorSchema).nonempty(),
});
export type Building = z.infer<typeof buildingSchema>;

/** Structured project metadata (portfolio card + about panel — doc 11 §5). */
export const projectMetadataSchema = z.object({
  author: z.string().min(1).optional(),
  software: z.string().min(1).optional(),
  renderEngine: z.string().min(1).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  client: z.string().min(1).optional(),
  license: z.string().min(1).optional(),
  website: z.string().url().optional(),
  location: z.string().min(1).optional(),
  categories: z.array(z.string().min(1)).optional(),
});
export type ProjectMetadata = z.infer<typeof projectMetadataSchema>;

export const projectManifestSchema = z.object({
  /** Semantic version of the manifest contract; same-major is accepted. */
  schemaVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'must be a semantic version (e.g. "1.0.0")')
    .refine((v) => Number(v.split('.')[0]) === SUPPORTED_SCHEMA_MAJOR, {
      message: `unsupported schemaVersion major — this engine reads ${String(SUPPORTED_SCHEMA_MAJOR)}.x.x`,
    }),
  id: slugSchema,
  title: requiredText('project title'),
  description: requiredText('project description'),
  metadata: projectMetadataSchema.optional(),
  /** Panorama the walkthrough starts at (F8 "Enter walkthrough"). */
  entrancePanorama: slugSchema,
  /** Panorama whose poster fronts the project card and OG image. */
  coverPanorama: slugSchema,
  buildings: z.array(buildingSchema).nonempty(),
});
export type ProjectManifest = z.infer<typeof projectManifestSchema>;

export type ParseResult =
  | { readonly ok: true; readonly project: ProjectManifest }
  | { readonly ok: false; readonly issues: readonly string[] };

/**
 * Parse unknown data into a validated ProjectManifest. Reports every schema
 * violation at once (contract §8: exhaustive, not first-failure).
 */
export function parseProjectManifest(data: unknown): ParseResult {
  const result = projectManifestSchema.safeParse(data);
  if (result.success) {
    return { ok: true, project: result.data };
  }
  const issues = result.error.issues.map(
    (issue) => `${issue.path.map(String).join('.') || '(root)'}: ${issue.message}`,
  );
  return { ok: false, issues };
}
