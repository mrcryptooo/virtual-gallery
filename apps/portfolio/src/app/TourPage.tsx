import { useEffect, useRef, useState } from 'react';
import {
  createPanoramaEngine,
  type InformationHotspot,
  type PanoramaEngine,
  type ProjectedHotspot,
  type ProjectManifest,
  type Panorama,
  type Wayfinding,
} from '@virtual-gallery/engine';
import { HotspotLayer } from '@/components/tour/HotspotLayer';
import { TourChrome } from '@/components/tour/TourChrome';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { Scrim } from '@/components/ui/Scrim';
import styles from './TourPage.module.css';

/**
 * Walkthrough page — the engine's reference client for the integration test.
 * Component-local state bridges engine events to React; the zustand stores
 * and URL sync formalize this wiring at M1.6 without changing the engine API.
 */
export function TourPage({ projectSlug }: { projectSlug: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<PanoramaEngine>(null);

  const [project, setProject] = useState<ProjectManifest>();
  const [panorama, setPanorama] = useState<Panorama>();
  const [wayfinding, setWayfinding] = useState<Wayfinding>();
  const [hotspots, setHotspots] = useState<readonly ProjectedHotspot[]>([]);
  const [info, setInfo] = useState<InformationHotspot>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const container = containerRef.current;
    if (container === null) return;
    const lifecycle = { disposed: false };
    const unsubscribes: (() => void)[] = [];

    void (async () => {
      const engine = await createPanoramaEngine(container);
      if (lifecycle.disposed) {
        engine.destroy();
        return;
      }
      engineRef.current = engine;
      if (import.meta.env.DEV) {
        // Dev-only handle: hotspot picking + camera control from the console
        (window as { __engine?: PanoramaEngine }).__engine = engine;
      }
      unsubscribes.push(
        engine.on('projectloaded', ({ project: loaded }) => {
          setProject(loaded);
        }),
        engine.on('panoramachanged', ({ panorama: pano, wayfinding: where }) => {
          setPanorama(pano);
          setWayfinding(where);
          setLoading(false);
        }),
        engine.on('hotspotsprojected', ({ hotspots: projected }) => {
          setHotspots(projected);
        }),
        engine.on('error', ({ message }) => {
          setError(message);
          setLoading(false);
        }),
      );
      try {
        await engine.loadProject(`/projects/${projectSlug}`);
      } catch {
        // error event already carries the details
      }
    })();

    return () => {
      lifecycle.disposed = true;
      for (const unsubscribe of unsubscribes) unsubscribe();
      engineRef.current?.destroy();
      engineRef.current = null;
    };
  }, [projectSlug]);

  const handleNavigate = ({ hotspot }: ProjectedHotspot) => {
    if (hotspot.type !== 'navigation') return;
    void engineRef.current?.goToPanorama(hotspot.target, { via: hotspot });
  };

  const handleInfo = ({ hotspot }: ProjectedHotspot) => {
    if (hotspot.type === 'information') setInfo(hotspot);
  };

  return (
    <div className={styles.page}>
      <div ref={containerRef} className={styles.viewer} />

      <HotspotLayer hotspots={hotspots} onNavigate={handleNavigate} onInfo={handleInfo} />

      {project !== undefined && panorama !== undefined && (
        <TourChrome
          projectTitle={project.title}
          panoramaTitle={panorama.title}
          wayfinding={wayfinding}
        />
      )}

      {loading && error === undefined && (
        <div className={styles.loading}>
          <span className={styles.loadingTitle}>Virtual Gallery</span>
        </div>
      )}

      {error !== undefined && (
        <div className={styles.error} role="alert">
          <p>The walkthrough could not be loaded.</p>
          <p>{error}</p>
        </div>
      )}

      {info !== undefined && (
        <>
          <Scrim
            onDismiss={() => {
              setInfo(undefined);
            }}
          />
          <Panel raised className={styles.infoPanel} role="dialog" aria-label={info.title}>
            <h2 className={styles.infoTitle}>{info.title}</h2>
            <p className={styles.infoBody}>{info.body}</p>
            <Button
              variant="ghost"
              onClick={() => {
                setInfo(undefined);
              }}
            >
              Close
            </Button>
          </Panel>
        </>
      )}
    </div>
  );
}
