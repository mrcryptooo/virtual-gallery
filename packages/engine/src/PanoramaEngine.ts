/**
 * PanoramaEngine — the public facade (doc 02 §2). Typed commands in, typed
 * events out; every PSV detail stays behind ViewerCore. Framework-free.
 *
 * Integration-test scope note (2026-07-09): this is the facade's first
 * implementation — project loading, navigation, the doc 10 §4 Tier-A
 * transition, and hotspot projection. The formal tour state machine (M1.3)
 * and streaming events (M1.5) extend it without changing this surface.
 */
import { buildProjectIndex, type ProjectIndex } from './domain/manifest/indexes.ts';
import type {
  Hotspot,
  NavigationHotspot,
  Panorama,
  ProjectManifest,
  View,
} from './domain/manifest/schema.ts';
import { loadProject } from './loader/loadProject.ts';
import type { ViewerCore } from './viewer/ViewerCore.ts';

/** Transition timing per doc 10 §2/§4: 900 ms scene move, one continuous curve. */
const SCENE_MS = 900;
const APPROACH_MS = Math.round(SCENE_MS * 0.4); // rotate/zoom toward hotspot
const BLEND_MS = Math.round(SCENE_MS * 0.6); // crossfade into destination
const FOV_NARROW_DEG = 12;

export interface ProjectedHotspot {
  readonly hotspot: Hotspot;
  readonly x: number;
  readonly y: number;
  readonly visible: boolean;
}

export interface Wayfinding {
  readonly building: string;
  readonly floor: string;
  readonly room: string;
}

export interface EngineEventMap {
  projectloaded: { project: ProjectManifest };
  panoramachanged: { panorama: Panorama; wayfinding: Wayfinding };
  viewchange: { view: View };
  hotspotsprojected: { hotspots: readonly ProjectedHotspot[] };
  transitionstart: { from: string; to: string };
  transitionend: { panoramaId: string };
  error: { code: 'load-failed' | 'not-found'; message: string; recoverable: boolean };
}

type Listener<K extends keyof EngineEventMap> = (payload: EngineEventMap[K]) => void;

export interface PanoramaEngine {
  loadProject(packageBaseUrl: string): Promise<void>;
  /** Navigate to a panorama; `via` (a navigation hotspot) enables the Street View move. */
  goToPanorama(id: string, options?: { via?: NavigationHotspot }): Promise<void>;
  lookAt(view: Partial<View>, durationMs?: number): void;
  getView(): View | undefined;
  getProject(): ProjectManifest | undefined;
  getCurrentPanorama(): Panorama | undefined;
  on<K extends keyof EngineEventMap>(event: K, listener: Listener<K>): () => void;
  destroy(): void;
}

export interface EngineOptions {
  /** Base URL of the project package (no trailing slash), e.g. `/projects/museum-test`. */
  readonly packageBaseUrl?: string;
}

export async function createPanoramaEngine(
  container: HTMLElement,
  options: EngineOptions = {},
): Promise<PanoramaEngine> {
  // Dynamic import keeps PSV/three out of clients that never mount a viewer
  // and out of non-DOM environments (chunk split — doc 08 §4).
  const { ViewerCore } = await import('./viewer/ViewerCore.ts');

  const listeners = new Map<keyof EngineEventMap, Set<Listener<never>>>();
  function emit<K extends keyof EngineEventMap>(event: K, payload: EngineEventMap[K]): void {
    const set = listeners.get(event);
    if (set === undefined) return;
    for (const listener of set) (listener as Listener<K>)(payload);
  }

  let project: ProjectManifest | undefined;
  let index: ProjectIndex | undefined;
  let packageBaseUrl = options.packageBaseUrl ?? '';
  let current: Panorama | undefined;
  let viewer: ViewerCore | undefined;
  let transitioning = false;
  let destroyed = false;

  function projectHotspots(): void {
    const activeViewer = viewer;
    if (activeViewer === undefined || current === undefined) return;
    const projected = current.hotspots.map((hotspot) => {
      const point = activeViewer.project(hotspot.yaw, hotspot.pitch);
      return { hotspot, x: point.x, y: point.y, visible: point.visible };
    });
    emit('hotspotsprojected', { hotspots: projected });
  }

  function handleViewChange(): void {
    if (viewer === undefined) return;
    emit('viewchange', { view: viewer.getView() });
    projectHotspots();
  }

  function wayfindingFor(panoramaId: string): Wayfinding {
    const location = index?.locate(panoramaId);
    return {
      building: location?.building.name ?? '',
      floor: location?.floor.name ?? '',
      room: location?.room.name ?? '',
    };
  }

  function announce(panorama: Panorama): void {
    emit('panoramachanged', { panorama, wayfinding: wayfindingFor(panorama.id) });
    // Hotspots of the new panorama need an immediate projection pass
    projectHotspots();
  }

  const engine: PanoramaEngine = {
    async loadProject(baseUrl: string): Promise<void> {
      packageBaseUrl = baseUrl;
      try {
        project = await loadProject(baseUrl);
      } catch (cause) {
        emit('error', { code: 'load-failed', message: String(cause), recoverable: false });
        throw cause;
      }
      index = buildProjectIndex(project);
      emit('projectloaded', { project });

      const entrance = index.getPanorama(project.entrancePanorama);
      if (entrance === undefined) return; // impossible post-invariants
      // Guard: destroy() during an in-flight load must not resurrect a viewer
      if (destroyed) return;
      viewer ??= new ViewerCore(container, entrance.initialView, {
        onViewChange: handleViewChange,
        onReady: handleViewChange,
      });
      current = entrance;
      await viewer.load(packageBaseUrl, entrance, entrance.initialView);
      announce(entrance);
    },

    async goToPanorama(id, opts = {}): Promise<void> {
      if (viewer === undefined || index === undefined) return;
      const target = index.getPanorama(id);
      if (target === undefined) {
        emit('error', { code: 'not-found', message: `panorama "${id}"`, recoverable: true });
        return;
      }
      if (transitioning || current?.id === id) return;
      transitioning = true;
      emit('transitionstart', { from: current?.id ?? '', to: id });

      const via = opts.via;
      const arrival = via?.arrivalView ?? target.initialView;
      try {
        if (via !== undefined) {
          // Doc 10 §4 phase 1: rotate toward the hotspot while FOV narrows —
          // the forward-motion cue, on the live panorama.
          const currentFov = viewer.getView().fov;
          viewer.animate(
            { yaw: via.yaw, pitch: via.pitch, fov: Math.max(30, currentFov - FOV_NARROW_DEG) },
            APPROACH_MS,
          );
          await new Promise((resolve) => setTimeout(resolve, APPROACH_MS));
          // Phase 2: blend into the destination at the narrowed FOV…
          await viewer.blendTo(
            packageBaseUrl,
            target,
            { ...arrival, fov: Math.max(30, arrival.fov - FOV_NARROW_DEG / 2) },
            BLEND_MS,
          );
          // …phase 3: release FOV to the arrival value over the final stretch.
          viewer.animate({ fov: arrival.fov }, Math.round(SCENE_MS * 0.3));
        } else {
          await viewer.load(packageBaseUrl, target, arrival);
        }
        current = target;
        announce(target);
      } finally {
        transitioning = false;
        emit('transitionend', { panoramaId: id });
      }
    },

    lookAt(view, durationMs = 300): void {
      viewer?.animate(view, durationMs);
    },

    getView: () => viewer?.getView(),
    getProject: () => project,
    getCurrentPanorama: () => current,

    on(event, listener) {
      let set = listeners.get(event);
      if (set === undefined) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(listener);
      return () => {
        set.delete(listener);
      };
    },

    destroy(): void {
      destroyed = true;
      viewer?.destroy();
      viewer = undefined;
      listeners.clear();
    },
  };

  return engine;
}
