import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import {
  bearing,
  isOnScreen,
  parseProjectManifest,
  type Panorama,
  type ProjectedHotspot,
} from '@virtual-gallery/engine';
import { HotspotLayer } from './HotspotLayer';

/**
 * Scope note (2026-08-11): modern-museum is now served by its own Marzipano
 * export at /p/modern-museum and is no longer rendered by this engine, so it is
 * not exercised here. Its integrity is gated by scripts/verify-marzipano.mjs.
 *
 * The guarantee this file exists to protect (owner requirement, 2026-07-31):
 * no scene may load without at least one discoverable navigation control
 * while it has outgoing navigation — at ANY viewport aspect, portrait phones
 * included.
 */

/** Viewports the fix must hold for. */
const VIEWPORTS = [
  { name: '390×844 portrait (iPhone 14)', w: 390, h: 844 },
  { name: '430×932 portrait (iPhone 15 Pro Max)', w: 430, h: 932 },
  { name: '844×390 landscape', w: 844, h: 390 },
  { name: '768×1024 tablet portrait', w: 768, h: 1024 },
  { name: '1366×768 desktop landscape', w: 1366, h: 768 },
];

/** jsdom has no layout: give the safe rectangle a real size. */
function stubLayout(width: number, height: number) {
  const inset = 24;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const isSafe = this.getAttribute('aria-hidden') === 'true';
    const box = isSafe
      ? { x: inset, y: inset, width: width - inset * 2, height: height - inset * 2 }
      : { x: 0, y: 0, width, height };
    return {
      ...box,
      top: box.y,
      left: box.x,
      right: box.x + box.width,
      bottom: box.y + box.height,
      toJSON: () => box,
    } as DOMRect;
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  );
}

/** Project a panorama's hotspots as the runtime would at a given viewport. */
function projectAt(panorama: Panorama, width: number, height: number): ProjectedHotspot[] {
  const view = panorama.initialView;
  return panorama.hotspots.map((hotspot) => {
    const b = bearing(view.yaw, view.pitch, hotspot.yaw, hotspot.pitch);
    const onScreen = isOnScreen(b, view.fov, width / height);
    return {
      hotspot,
      x: width / 2,
      y: height / 2,
      onScreen,
      angleDeg: b.angleDeg,
      deltaYaw: b.deltaYaw,
      deltaPitch: b.deltaPitch,
    };
  });
}

function loadPanoramas(slug: string): Panorama[] {
  const path = join(process.cwd(), 'public', 'projects', slug, 'project.json');
  const parsed = parseProjectManifest(JSON.parse(readFileSync(path, 'utf8')));
  if (!parsed.ok) throw new Error(`${slug}: ${parsed.issues.join('; ')}`);
  return parsed.project.buildings.flatMap((b) =>
    b.floors.flatMap((f) => f.rooms.flatMap((r) => r.panoramas)),
  );
}

const noop = () => undefined;

describe('HotspotLayer', () => {
  it('renders an on-screen navigation hotspot as an activatable button', () => {
    stubLayout(1366, 768);
    const onNavigate = vi.fn();
    const projected = projectAt(
      {
        id: 'p',
        title: 'P',
        description: 'd',
        poster: { alt: 'a' },
        initialView: { yaw: 0, pitch: 0, fov: 90 },
        tiles: {
          projection: 'cube',
          version: 'abcdef12',
          tileSize: 512,
          faceSize: 1024,
          previewSize: 256,
          formats: ['png'],
        },
        hotspots: [
          {
            type: 'navigation',
            yaw: 5,
            pitch: 0,
            label: 'Go to the terrace',
            target: 'q',
            arrivalView: { yaw: 0, pitch: 0, fov: 90 },
          },
        ],
      },
      1366,
      768,
    );
    render(
      <HotspotLayer hotspots={projected} onNavigate={onNavigate} onInfo={noop} onOrient={noop} />,
    );
    const button = screen.getByRole('button', { name: /go to the terrace/i });
    fireEvent.click(button);
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it('renders an off-screen navigation hotspot as an edge indicator that orients the view', () => {
    stubLayout(390, 844);
    const onOrient = vi.fn();
    const onNavigate = vi.fn();
    const hotspot = {
      type: 'navigation' as const,
      yaw: 120,
      pitch: 0,
      label: 'On to bay 2',
      target: 'bay-2',
      arrivalView: { yaw: 0, pitch: 0, fov: 90 },
    };
    const b = bearing(0, 0, hotspot.yaw, hotspot.pitch);
    render(
      <HotspotLayer
        hotspots={[
          {
            hotspot,
            x: 0,
            y: 0,
            onScreen: false,
            angleDeg: b.angleDeg,
            deltaYaw: b.deltaYaw,
            deltaPitch: b.deltaPitch,
          },
        ]}
        onNavigate={onNavigate}
        onInfo={noop}
        onOrient={onOrient}
      />,
    );
    // Accessible name states the destination AND the direction (doc 09 §2)
    const button = screen.getByRole('button', {
      name: /on to bay 2.*to your right.*turn to view/i,
    });
    fireEvent.click(button);
    expect(onOrient).toHaveBeenCalledOnce();
    // Orienting must never navigate directly (doc 10 §1: motion explains space)
    expect(onNavigate).not.toHaveBeenCalled();
  });

  it('has no accessibility violations with a mix of on- and off-screen hotspots', async () => {
    stubLayout(390, 844);
    const panoramas = loadPanoramas('museum-test');
    const scene = panoramas.find((p) => p.hotspots.length > 1) ?? panoramas[0]!;
    const { container } = render(
      <HotspotLayer
        hotspots={projectAt(scene, 390, 844)}
        onNavigate={noop}
        onInfo={noop}
        onOrient={noop}
      />,
    );
    expect(await axe(container)).toHaveNoViolations();
  });
});

describe.each(VIEWPORTS)('discoverable navigation at $name', ({ w, h }) => {
  it.each(['museum-test'])('every %s scene with outgoing navigation exposes a control', (slug) => {
    const panoramas = loadPanoramas(slug);
    const withNavigation = panoramas.filter((p) =>
      p.hotspots.some((hotspot) => hotspot.type === 'navigation'),
    );
    expect(withNavigation.length).toBeGreaterThan(0);

    const bare: string[] = [];
    for (const panorama of withNavigation) {
      stubLayout(w, h);
      const { unmount } = render(
        <HotspotLayer
          hotspots={projectAt(panorama, w, h)}
          onNavigate={noop}
          onInfo={noop}
          onOrient={noop}
        />,
      );
      const controls = screen.queryAllByRole('button');
      if (controls.length === 0) bare.push(panorama.id);
      unmount();
      vi.restoreAllMocks();
    }
    expect(bare, `scenes with no navigation control at ${String(w)}×${String(h)}`).toEqual([]);
  });
});

describe('portrait regression', () => {
  it('exercises the edge-indicator path: portrait pushes hotspots off-screen', () => {
    const panoramas = loadPanoramas('museum-test');
    const offScreenInPortrait = panoramas.filter(
      (p) => p.hotspots.length > 0 && projectAt(p, 390, 844).every((h) => !h.onScreen),
    );
    // If this ever hits zero the indicators are dead code and the guarantee
    // above would pass vacuously — keep the regression honest.
    expect(offScreenInPortrait.length).toBeGreaterThan(0);
  });
});
