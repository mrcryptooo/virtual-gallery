# 01 — Product Requirements

**Status: FROZEN (v3, 2026-07-08).** Approved by the owner. The v1 assumptions review is complete; former open assumptions are resolved below.

## 1. Product definition

The product is two things, in a deliberate order:

1. **A reusable Panorama Engine** — a premium web-based immersive panorama walkthrough system inspired by Google Street View. It presents ultra-high-resolution 360° imagery organized as navigable spaces, with hotspot navigation and cinematic scene-to-scene transitions. It is written as a self-contained, embeddable package with no knowledge of any particular website.
2. **The portfolio — the engine's first implementation.** The owner is a **CGI artist** producing ultra-high-quality **8K/16K equirectangular renders in Lumion**. The portfolio site presents those rendered environments as explorable walkthroughs, wrapped in a premium UI.

```
Lumion render
   ↓
8K/16K equirectangular panorama
   ↓
Asset pipeline → self-contained project package (tiled cube map + manifest)
   ↓
Drop package into public/projects/  →  auto-discovered
   ↓
Panorama viewer (full-bleed, buttery pan/zoom)
   ↓
Hotspots (Street View-style navigation + info points)
   ↓
Street View-style transition (move toward hotspot, blend into destination)
   ↓
Next panorama
```

**The panorama images are the product. The engine only presents them.** Every decision optimizes for image fidelity, streaming speed, transition smoothness, and premium presentation — never for realtime geometry.

### Hard exclusions (v1 line)

- **No realtime 3D models.** No GLB/glTF content, no meshes, no scene geometry beyond the projection surface the viewer uses internally.
- **No walkable free-movement world.** Movement is discrete: panorama → hotspot → next panorama.
- No virtual museum framing, no user accounts, no purchases, no VR headset mode in v1.

### Resolved assumptions (formerly open; confirmed at v3 review)

| # | Resolution |
|---|-----------|
| A1 | The site is a **portfolio of multiple projects**. Projects can be very large architectural visualizations — the content model is hierarchical (see §3.1). |
| A2 | Sources are mono equirectangular stills (2:1, 8192×4096 minimum, 16384×8192 preferred), 8-bit sRGB from Lumion. |
| A3 | Content is file-based and **completely content-driven**: publishing = copying a project package folder into `public/projects/`. No CMS, no upload UI in v1. |
| A4 | Hotspot yaw/pitch is authored via manifest + dev-mode picker in v1; a visual editor is post-v1. |
| A5 | Fully static hosting; no backend runtime. |
| A6 | Desktop and mobile first-class; gyro look v1.x; WebXR future vision. |

## 2. Users and jobs

| Persona | Description | Primary job |
|---------|-------------|-------------|
| **Visitor / prospective client** | Architects, developers, agencies evaluating the artist's work. Judges quality in seconds. | Be impressed: explore environments effortlessly, understand large projects spatially (which building, which floor), find contact info. |
| **Assistive-tech / low-motion visitor** | Keyboard-only, screen reader, or vestibular-sensitive. | Access every panorama's imagery and information without the immersive viewer. |
| **The artist (owner)** | Creates renders in Lumion; not necessarily a programmer. | Publish a project by running the pipeline and copying one folder. Never touch source code. |
| **Future engine adopter** | The owner (or a licensee) embedding the engine in another site or client deliverable. | Consume a documented engine API and the project-package format; bring their own UI if desired. |

## 3. Functional requirements

### 3.1 Content model (the hierarchy)

Content is organized for very large architectural projects:

```
Portfolio → Project → Building → Floor → Room → Panorama
```

- Every level has an id, name, and (from Project down) an optional description.
- **Panorama ids are unique within a project** (flat namespace) — hotspot links and deep links reference panoramas directly; the hierarchy above them is organizational and navigational.
- The UI elides singular levels: a project with one building never shows building navigation; a house with one floor never shows a floor switcher. Small projects stay simple; large ones stay navigable.
- Hotspot links may cross rooms, floors, and buildings (e.g., a stairwell panorama links across floors).

### 3.2 Must have (v1)

- **F1 — Panorama viewer.** Full-viewport rendering via Photo Sphere Viewer on three.js (ADR-002): drag/touch look, scroll/pinch zoom, inertial damping tuned to doc 10, pole-safe limits. 60 fps pan on mid-tier devices.
- **F2 — Progressive resolution.** Tiled cube-map streaming (ADR-004): a panorama is viewable in < 2.5 s (blur-up preview), then sharpens the current gaze direction to full source fidelity.
- **F3 — Navigation hotspots.** Street View-style directional markers (yaw/pitch anchored, DOM-rendered, keyboard-reachable, screen-reader labeled). Activating one moves to the linked panorama.
- **F4 — Street View transition.** The camera **moves toward the activated hotspot** (view rotation + forward zoom) before **blending into the destination panorama** at its authored arrival direction. Simple fades are explicitly not acceptable as the default transition (reduced-motion mode is the sole exception — doc 09/10). Interruption-safe.
- **F5 — Space Index / accessible parallel mode.** Every project offers a 2D semantic-HTML index mirroring the hierarchy — buildings → floors → rooms → panoramas, each with a still, name, and description. Full content parity without WebGL (doc 09).
- **F6 — Info hotspots.** Points opening a panel (title + rich text + optional image) for design commentary, materials, credits.
- **F7 — Deep links.** Shareable URLs encode project, panorama, and view direction (`/p/:project/pano/:pano?y&p&f`); opening one lands exactly on that view. Hierarchy context (building/floor/room) is derived from the manifest, not the URL.
- **F8 — Wayfinding.** The tour chrome always shows where the visitor is: *Building · Floor · Room* breadcrumb (elided per §3.1), panorama name, and the Space Index one action away.
- **F9 — Drop-in projects.** Adding a project = copying a self-contained package folder into `public/projects/`. **No source-code changes, no imports, no route modifications.** The engine discovers projects automatically via a generated discovery index (build-time scan — ADR-013); a redeploy is the only step after copying.
- **F10 — JSON manifests.** All content — hierarchy, panoramas, hotspots, views, tile metadata — in validated JSON inside the project package. The manifest schema is a public contract of the engine.
- **F11 — Project loader & portfolio UI.** Premium portfolio home (auto-populated from discovered projects) → project page → walkthrough. Minimal auto-hiding tour chrome.
- **F12 — Loading experience.** Designed loading at every level; never a black viewport or raw spinner.

### 3.3 Should have (v1.x)

- **F13 — Gyroscope look** (permission-gated, off by default).
- **F14 — Guided autoplay** (walks the tour; any input cancels).
- **F15 — Floorplan minimap** per floor (authored image + panorama positions in manifest).
- **F16 — Ambient audio** per project (opt-in, muted default).

### 3.4 Future vision (explicitly not now)

Visual tour editor; client-review mode (private links, comments); engine distributed as a versioned npm package with docs site; WebXR panoramic viewing; video panoramas; depth-assisted transitions from Lumion depth exports.

## 4. Non-functional requirements (summarized, owned by other docs)

| Concern | Requirement | Owning doc |
|---------|-------------|------------|
| Performance | First view < 2.5 s; 60 fps pan; ≤ 100 ms transition start; strict tile/memory budgets | [08](08-performance.md) |
| Visual quality | No visible seams/banding/artifacts at rest; Apple-level polish; Awwwards-quality interactions | [08](08-performance.md), [10](10-animation-guidelines.md), [11](11-design-system.md) |
| Accessibility | WCAG 2.2 AA; Space Index parity; reduced-motion transitions | [09](09-accessibility.md) |
| Browser support | Last 2 versions Chrome/Edge/Firefox/Safari; iOS Safari, Android Chrome. WebGL2 for the viewer; Space Index works without WebGL. | [02](02-architecture.md) |
| Reusability | Engine package has zero portfolio imports; consumable by another app as-is | [02](02-architecture.md), [06](06-coding-standards.md) |
| Privacy | Self-hosted fonts/assets; no third-party trackers | [04](04-technical-decisions.md) |
| Hosting | Fully static | [02](02-architecture.md) |

## 5. Success criteria

- A visitor on a mid-range phone is inside a panorama within 3 s of choosing a project and inside a second panorama within 15 s, unaided.
- In a large project (2+ buildings, 3+ floors), a first-time visitor can name where they are (building/floor/room) at any moment and can jump to any other room in ≤ 3 actions via the Space Index.
- The artist publishes a new project end-to-end (Lumion → pipeline → copy folder → live) without editing anything under `src/` or `apps/`.
- The transition reads as *movement through space*, not as a fade, in owner review on real content.
- 100% of panoramas and their information are available via keyboard and screen reader through the Space Index.

## 6. Out-of-scope guardrails

- Anything requiring realtime geometry is out of the entire v1 line.
- No backend services, databases, or auth in v1.
- No third-party UI kits; the design system (doc 11) is the only component source.
- The viewer foundation (Photo Sphere Viewer, ADR-002) is frozen; replacing it requires a superseding ADR approved by the owner.
