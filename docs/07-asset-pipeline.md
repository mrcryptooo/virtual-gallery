# 07 — Asset Pipeline (360° Imagery)

**Status: FROZEN (v3, 2026-07-08).**

How a Lumion render becomes a published, streaming walkthrough. The pipeline is scripted, deterministic, incremental, and CI-gated. Its output is a **self-contained project package** — the unit of publishing (copy into `public/projects/`) and the engine's content contract (ADR-010/013). **Masters are sacred; packages are disposable and regenerable.**

## 1. Principles

1. **One command from renders to publishable package.** The artist exports from Lumion, drops files into `content-src/<slug>/`, runs the pipeline, copies the output folder. No Photoshop pre-processing, no manual slicing, no hand-edited tiles — ever.
2. **Authoring manifest in, published manifest out.** The artist edits `project.authoring.json` (hierarchy, names, descriptions, hotspots, views). The pipeline validates it, stamps in generated tile metadata and content-hash versions, and emits the package's `project.json`. The artist never writes a tile path.
3. **Quality gates live here.** Budget violations (doc 08 §3), banding, and broken links fail the pipeline locally and in CI — the earliest possible failure point.

## 2. Flow

```
content-src/<slug>/panos/*.png|tif|jpg      (Lumion equirect masters, 2:1)
content-src/<slug>/project.authoring.json   (hierarchy → panoramas → hotspots)
        │
        ▼  scripts/build-package.mjs  (sharp/libvips + custom reprojection)
┌──────────────────────────────────────────────────────────────┐
│ 1. Validate masters: 2:1 aspect, ≥ 8192×4096, sRGB           │
│ 2. Validate authoring manifest against hierarchy schema      │
│ 3. Reproject equirect → 6 cube faces (Lanczos3, pole-        │
│    oversampled; face = master width / 4)                     │
│ 4. Slice per-face quadtree pyramids, 512-px tiles            │
│    16K → face 4096, levels 512/1024/2048/4096                │
│    8K  → face 2048, levels 512/1024/2048                     │
│    Layout matches the PSV cubemap-tiles-adapter URL template │
│ 5. Encode AVIF + WebP (quality per level, §4)                │
│ 6. Preview cube (6×256) per panorama                         │
│ 7. Posters (2048, authored view) + thumbs (480) + OG crops   │
│ 8. Quality gates: cross-face seam continuity, banding check  │
│ 9. Emit package: project.json (+ tile metadata, content-hash │
│    version segment) — enforce per-asset budgets              │
└───────────────────────────┬──────────────────────────────────┘
                            ▼
      dist-packages/<slug>/            (finished project package)
      ├── project.json
      ├── tiles/<hash8>/<pano>/<level>/<face>/<x>_<y>.avif|.webp
      ├── tiles/<hash8>/<pano>/preview/<face>.avif|.webp
      └── posters/…
                            ▼
      COPY into apps/portfolio/public/projects/<slug>/   ← the publishing act (F9)
                            ▼
      build-time discovery scan → projects-index.json → deploy → CDN
```

`scripts/validate-packages.mjs` runs over everything in `public/projects/` in CI: schema (semver `schemaVersion`, hierarchy, ids unique), every referenced tile/preview/poster exists, hotspot targets resolve, **names/descriptions/alt text present (missing text fails)**, link graph has no orphan panoramas.

## 3. Package inventory per panorama

| Asset | Format | Spec | Purpose |
|---|---|---|---|
| Tile pyramid | AVIF + WebP | 512-px tiles, levels per §2, adapter-layout paths | The panorama, streamed by visibility |
| Preview cube | AVIF + WebP | 6 × 256 px, ≤ ~300 KB total | Instant first view (blur-up); transition source; prefetch unit |
| Poster | AVIF + WebP + JPEG | 2048 px, authored view | Space Index, project cards, OG/social |
| Thumb | AVIF + WebP | 480 px | Space Index grids, floorplan minimap (v1.x) |

Budget numbers are owned by [08-performance.md](08-performance.md) §3. Tile URLs are content-addressed (`tiles/<hash8>/…`), so packages in `public/` are long-cache safe without bundler hashing (ADR-012); re-rendering a panorama changes its hash segment and invalidates cleanly.

## 4. Encoding policy (ADR-005)

- Quality rises with level depth: previews encode aggressively (seen blurred, briefly); the deepest level encodes near-transparent (what the visitor studies). Starting points AVIF q≈50 → q≈68; 4:4:4 chroma at the deepest level (CGI edges suffer under 4:2:0). Tuned per project against the banding gate.
- Everything sRGB; ICC stripped after conversion.
- **Banding gate:** gradient regions (skies, plain walls) compared against masters; visible posterization fails the build, pointing at the scene and suggesting the per-scene `"quality": "max"` override.

## 5. Lumion export conventions (artist-facing)

- 360 panorama, **equirectangular 2:1**, maximum quality: 16384×8192 preferred, 8192×4096 minimum; PNG or highest-quality JPEG; no watermarks or overlays.
- Consistent camera height (~1.6 m eye level) across a project — height jumps break the step-through illusion.
- Neighboring panoramas 2-6 m apart with visual overlap, Street View-style; the destination should be visible from the origin for the transition to read as movement (doc 10 §4).
- Consistent sun/exposure within a project; per-scene jumps show in transitions (continuity check warns).
- Filename = panorama id: `living-room-1.png`. Panorama ids are project-unique (ADR-014); room/floor/building assignment happens in the authoring manifest, not the filename.

## 6. Commands

```
npm run package:build -- <slug>   # content-src/<slug> → dist-packages/<slug> (incremental)
npm run packages:validate         # all of public/projects/ against the contract
npm run hotspots:pick -- <slug>   # dev viewer + yaw/pitch picker → authoring-manifest snippets
npm run budget:check              # per-asset + bundle budgets (also in CI)
```

Incremental: outputs cached by master-file + authoring-manifest hash in `.asset-cache/`; a 16K scene takes minutes to tile, so only changed panoramas reprocess. CI restores the cache keyed the same way.

## 7. Publishing a project (artist runbook)

1. Create `content-src/<slug>/`; drop panorama masters into `panos/`.
2. Copy the authoring-manifest template. Define the hierarchy (buildings → floors → rooms — single-building projects just have one building entry), then per panorama: name, **description (required — it is the accessibility text)**, room assignment, initial view, hotspots (`npm run hotspots:pick` gives yaw/pitch), arrival views per link.
3. `npm run package:build -- <slug>` — fix anything the gates report.
4. Review every panorama in the local viewer: seams, poles, banding, hotspot placement, transition feel between neighbors.
5. **Copy `dist-packages/<slug>/` into `apps/portfolio/public/projects/<slug>/`.** That is the entire integration — no code, no imports, no routes (F9/ADR-013).
6. Open a `content/…` PR. CI revalidates all packages and deploys on merge — no code review needed (doc 06 §9).
