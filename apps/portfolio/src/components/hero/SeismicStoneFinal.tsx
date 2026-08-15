import { useCallback, useEffect, useRef, useState } from 'react';
/**
 * PROVISIONAL, OWNER-APPROVED EXCEPTION to the frozen app/three boundary
 * (doc 02 §8: "apps/portfolio/components/ → NO psv, NO three, NO engine
 * internals"). Explicitly scoped to this single landing-page WebGL Hero
 * only -- not a precedent for other components. Now shipping in production
 * (landing route `/`, lazy-loaded from LandingPage.tsx) with this exception
 * still open. Follow-up (not blocking this release): either move this
 * rendering into the engine behind a typed public API, or formally amend
 * doc 02 §8 for non-panorama WebGL surfaces.
 */
// eslint-disable-next-line boundaries/external
import * as THREE from 'three';
import { ALL_PIECES, DEBRIS_PIECES, PRIMARY_PIECES, type PieceSpec } from './stoneFinalData';
import styles from './SeismicStoneFinal.module.css';

export interface SeismicStoneFinalProps {
  label?: string;
  /** Where the stone navigates on activation. Defaults to the museum route. */
  href?: string;
}

type StoneState = 'idle' | 'open' | 'entering';

const STONE_BODY_COLOR = 0x593d49;
const STONE_GLOW_COLOR = 0xd494af;
const ENTER_PREVIEW_MS = 650;
const ENTER_PUSH = 1.35;
const OPEN_RATE = 0.1;
const CLOSE_RATE = 0.13;
const PIECE_DEPTH = 0.34;

interface PieceRuntime {
  mesh: THREE.Mesh;
  spec: PieceSpec;
  progress: number;
}

function buildPieceMesh(spec: PieceSpec, material: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape();
  const pts = spec.closedPoints;
  const first = pts[0];
  if (!first) throw new Error(`piece ${spec.id} has no points`);
  shape.moveTo(first[0], first[1]);
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i];
    if (p) shape.lineTo(p[0], p[1]);
  }
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: PIECE_DEPTH,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 1,
  });
  geometry.translate(0, 0, -PIECE_DEPTH / 2);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData['pieceId'] = spec.id;
  return mesh;
}

export function SeismicStoneFinal({
  label = 'Enter the Seismic Museum',
  href = '/p/modern-museum',
}: SeismicStoneFinalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState<StoneState>('idle');
  const [webglAvailable, setWebglAvailable] = useState(true);
  const stateRef = useRef<StoneState>('idle');
  const reduceMotionRef = useRef(false);
  const enterTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const navigateTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotionRef.current = query.matches;
    const onChange = () => {
      reduceMotionRef.current = query.matches;
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    } catch {
      setWebglAvailable(false);
      return;
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 11);
    camera.lookAt(0, 0, 0);

    const ambient = new THREE.AmbientLight(0xffffff, 0.3);
    const key = new THREE.DirectionalLight(0xffffff, 1.1);
    key.position.set(-4, 5, 6);
    const fill = new THREE.DirectionalLight(0xf3e2ea, 0.3);
    fill.position.set(5, 1, 4);
    const rim = new THREE.DirectionalLight(STONE_GLOW_COLOR, 0.3);
    rim.position.set(-1, -3, -6);
    scene.add(ambient, key, fill, rim);

    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: STONE_BODY_COLOR,
      roughness: 0.9,
      metalness: 0.03,
      flatShading: true,
      emissive: new THREE.Color(STONE_GLOW_COLOR),
      emissiveIntensity: 0.045,
    });

    const stoneGroup = new THREE.Group();
    const pieces: PieceRuntime[] = ALL_PIECES.map((spec) => {
      const mesh = buildPieceMesh(spec, bodyMaterial);
      stoneGroup.add(mesh);
      return { mesh, spec, progress: 0 };
    });

    const coreGeometry = new THREE.IcosahedronGeometry(1, 1);
    coreGeometry.scale(1.7, 2.1, 0.9);
    const coreMaterial = new THREE.MeshBasicMaterial({
      color: STONE_GLOW_COLOR,
      transparent: true,
      opacity: 0.6,
    });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.z = -0.6;
    stoneGroup.add(core);

    scene.add(stoneGroup);

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    let frameId = 0;
    let elapsed = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      const reduced = reduceMotionRef.current;
      const current = stateRef.current;
      const isSeparated = current === 'open' || current === 'entering';
      const push = current === 'entering' ? ENTER_PUSH : 1;

      if (!reduced) {
        stoneGroup.position.y = Math.sin(elapsed * ((Math.PI * 2) / 9)) * 0.1;
        stoneGroup.rotation.z = Math.sin(elapsed * ((Math.PI * 2) / 11)) * 0.01;
      }

      for (const piece of pieces) {
        const target = isSeparated ? 1 * push : 0;
        const rate = isSeparated ? OPEN_RATE : CLOSE_RATE;
        if (reduced) {
          piece.progress = 0;
        } else {
          piece.progress += (target - piece.progress) * (1 - Math.pow(1 - rate, dt * 60));
        }
        const localProgress = Math.max(0, Math.min(1.5, piece.progress - piece.spec.order * 0.02));
        const [ox, oy, oz] = piece.spec.openOffset;
        piece.mesh.position.set(ox * localProgress, oy * localProgress, oz * localProgress);
        piece.mesh.rotation.z = piece.spec.rotation * localProgress;
        piece.mesh.rotation.x = piece.spec.rotation * 0.3 * localProgress;
      }

      const coreTarget = reduced ? 0.6 : isSeparated ? 1.0 : 0.55;
      coreMaterial.opacity += (coreTarget - coreMaterial.opacity) * 0.08;
      bodyMaterial.emissiveIntensity +=
        ((isSeparated ? 0.15 : 0.045) - bodyMaterial.emissiveIntensity) * 0.08;

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      for (const piece of pieces) {
        piece.mesh.geometry.dispose();
      }
      coreGeometry.dispose();
      coreMaterial.dispose();
      bodyMaterial.dispose();
      renderer.dispose();
    };
  }, []);

  const handlePointerEnter = useCallback(() => {
    setState((prev) => (prev === 'entering' ? prev : 'open'));
  }, []);

  const handlePointerLeave = useCallback(() => {
    setState((prev) => (prev === 'open' ? 'idle' : prev));
  }, []);

  const handleActivate = useCallback(() => {
    if (enterTimeout.current !== undefined) clearTimeout(enterTimeout.current);
    if (navigateTimeout.current !== undefined) clearTimeout(navigateTimeout.current);
    setState('entering');
    enterTimeout.current = setTimeout(() => {
      window.location.assign(href);
    }, ENTER_PREVIEW_MS);
  }, [href]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleActivate();
      }
    },
    [handleActivate],
  );

  return (
    <div ref={containerRef} className={styles['stage']}>
      <canvas ref={canvasRef} className={styles['canvas']} aria-hidden="true" />
      <button
        type="button"
        className={styles['hitArea']}
        aria-label={label}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onClick={handleActivate}
        onKeyDown={handleKeyDown}
        data-state={state}
        data-webgl={webglAvailable ? 'available' : 'unavailable'}
        data-piece-count={PRIMARY_PIECES.length + DEBRIS_PIECES.length}
      />
    </div>
  );
}
