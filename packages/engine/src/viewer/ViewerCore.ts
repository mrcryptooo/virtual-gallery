/**
 * ViewerCore — the PSV integration layer (doc 02 §2.1, ADR-002).
 *
 * Wraps Photo Sphere Viewer + CubemapTilesAdapter: context management,
 * cube-tile streaming, and input come from PSV; this layer owns
 * configuration-as-product (motion, limits, disabled PSV UI) and keeps every
 * PSV type strictly internal — nothing PSV-shaped crosses the engine API.
 */
import { Viewer } from '@photo-sphere-viewer/core';
import type { AnimateOptions, Position } from '@photo-sphere-viewer/core';
import { CubemapTilesAdapter } from '@photo-sphere-viewer/cubemap-tiles-adapter';
import type { CubemapMultiTilesPanorama } from '@photo-sphere-viewer/cubemap-tiles-adapter';
import '@photo-sphere-viewer/core/index.css';
import type { CubeFace, Panorama, View } from '../domain/manifest/schema.ts';
import { levelFaceSizes, previewPath, tilePath, tilesPerAxis } from '../domain/manifest/paths.ts';

/** FOV limits (doc 10 §3); PSV zoom 0–100 maps linearly maxFov→minFov. */
const MIN_FOV = 30;
const MAX_FOV = 110;

const DEG = Math.PI / 180;

/** Manifest cube faces → PSV cubemap face keys. */
const FACE_TO_PSV: Record<CubeFace, 'front' | 'right' | 'back' | 'left' | 'top' | 'bottom'> = {
  front: 'front',
  right: 'right',
  back: 'back',
  left: 'left',
  up: 'top',
  down: 'bottom',
};
const PSV_TO_FACE: Record<string, CubeFace> = Object.fromEntries(
  Object.entries(FACE_TO_PSV).map(([ours, psv]) => [psv, ours as CubeFace]),
);

export interface ScreenPoint {
  readonly x: number;
  readonly y: number;
  /** False when the direction is outside the current viewport. */
  readonly visible: boolean;
}

export interface ViewerCoreEvents {
  onViewChange: () => void;
  onReady: () => void;
}

function fovToZoom(fov: number): number {
  return (100 * (MAX_FOV - fov)) / (MAX_FOV - MIN_FOV);
}

function zoomToFov(zoom: number): number {
  return MAX_FOV - (zoom / 100) * (MAX_FOV - MIN_FOV);
}

export class ViewerCore {
  private readonly viewer: Viewer;
  private destroyed = false;

  constructor(container: HTMLElement, initial: View, events: ViewerCoreEvents) {
    this.viewer = new Viewer({
      container,
      adapter: CubemapTilesAdapter,
      navbar: false, // all UI belongs to the client (doc 02 §2.1)
      loadingTxt: '',
      mousewheel: true,
      keyboard: 'always',
      moveInertia: true,
      defaultYaw: initial.yaw * DEG,
      defaultPitch: initial.pitch * DEG,
      minFov: MIN_FOV,
      maxFov: MAX_FOV,
      defaultZoomLvl: fovToZoom(initial.fov),
    });

    this.viewer.addEventListener('position-updated', events.onViewChange);
    this.viewer.addEventListener('zoom-updated', events.onViewChange);
    this.viewer.addEventListener('ready', events.onReady, { once: true });
  }

  /** Adapter config for a panorama out of the canonical package layout. */
  private panoramaConfig(packageBaseUrl: string, panorama: Panorama): CubemapMultiTilesPanorama {
    const tiles = panorama.tiles;
    const format = tiles.formats[0];
    const url = (rel: string) => `${packageBaseUrl}/${rel}`;
    const sizes = levelFaceSizes(tiles);

    const baseUrl = Object.fromEntries(
      (Object.keys(FACE_TO_PSV) as CubeFace[]).map((face) => [
        FACE_TO_PSV[face],
        url(previewPath(panorama.id, tiles, face, format)),
      ]),
    ) as Record<'front' | 'right' | 'back' | 'left' | 'top' | 'bottom', string>;

    return {
      baseUrl,
      levels: sizes.map((faceSize) => ({
        faceSize,
        nbTiles: tilesPerAxis(faceSize, tiles.tileSize),
      })),
      tileUrl: (psvFace, col, row, level) => {
        const face = PSV_TO_FACE[psvFace];
        const levelSize = sizes[level];
        if (face === undefined || levelSize === undefined) return null;
        return url(tilePath(panorama.id, tiles, levelSize, face, col, row, format));
      },
    };
  }

  /** Immediate load (initial scene / deep link). */
  async load(packageBaseUrl: string, panorama: Panorama, view: View): Promise<void> {
    await this.viewer.setPanorama(this.panoramaConfig(packageBaseUrl, panorama), {
      position: { yaw: view.yaw * DEG, pitch: view.pitch * DEG },
      zoom: fovToZoom(view.fov),
      transition: false,
      showLoader: false,
    });
  }

  /**
   * Blend into the destination panorama (transition phase 2 — doc 10 §4).
   * Rotation is disabled: the Transition Director owns all camera motion.
   */
  async blendTo(
    packageBaseUrl: string,
    panorama: Panorama,
    arrival: View,
    blendMs: number,
  ): Promise<void> {
    await this.viewer.setPanorama(this.panoramaConfig(packageBaseUrl, panorama), {
      position: { yaw: arrival.yaw * DEG, pitch: arrival.pitch * DEG },
      zoom: fovToZoom(arrival.fov),
      transition: { speed: blendMs, rotation: false, effect: 'fade' },
      showLoader: false,
    });
  }

  /** Animated camera move (transition phase 1, keyboard traversal). */
  animate(target: Partial<View>, durationMs: number): { cancel: () => void } {
    const options: AnimateOptions = {
      speed: durationMs,
      ...(target.yaw !== undefined ? { yaw: target.yaw * DEG } : {}),
      ...(target.pitch !== undefined ? { pitch: target.pitch * DEG } : {}),
      ...(target.fov !== undefined ? { zoom: fovToZoom(target.fov) } : {}),
    };
    const animation = this.viewer.animate(options);
    return {
      cancel: () => {
        animation.cancel();
      },
    };
  }

  getView(): View {
    const position = this.viewer.getPosition();
    let yaw = position.yaw / DEG;
    if (yaw > 180) yaw -= 360;
    return {
      yaw,
      pitch: position.pitch / DEG,
      fov: zoomToFov(this.viewer.getZoomLevel()),
    };
  }

  /** Project a manifest direction to viewer pixels (hotspot DOM layer). */
  project(yawDeg: number, pitchDeg: number): ScreenPoint {
    const position: Position = { yaw: yawDeg * DEG, pitch: pitchDeg * DEG };
    // Visibility: angular distance from the view center within a loose cone
    const current = this.viewer.getPosition();
    const a1 = position;
    const cos =
      Math.sin(a1.pitch) * Math.sin(current.pitch) +
      Math.cos(a1.pitch) * Math.cos(current.pitch) * Math.cos(a1.yaw - current.yaw);
    const angularDeg = Math.acos(Math.max(-1, Math.min(1, cos))) / DEG;
    if (angularDeg > 95) {
      return { x: 0, y: 0, visible: false };
    }
    const point = this.viewer.dataHelper.sphericalCoordsToViewerCoords(position);
    const size = this.viewer.getSize();
    const inViewport =
      point.x >= -40 && point.y >= -40 && point.x <= size.width + 40 && point.y <= size.height + 40;
    return { x: point.x, y: point.y, visible: inViewport };
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.viewer.destroy();
  }
}
