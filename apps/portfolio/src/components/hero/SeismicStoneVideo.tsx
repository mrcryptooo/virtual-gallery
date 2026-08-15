import { useCallback, useEffect, useRef } from 'react';
import styles from './SeismicStoneVideo.module.css';

/**
 * Seismic Stone hero — the reference video itself is the visual asset (no
 * WebGL reconstruction). The stone's open/closed state is driven entirely by
 * scrubbing `video.currentTime` across a single deterministic CLOSED→OPEN
 * range, smoothed by a damped pointer-following target so it feels tactile
 * rather than "hover = play". See docs note in LandingPage.tsx for the
 * measured timing/geometry this was derived from.
 */

const VIDEO_SRC = '/hero/seismic-stone.mp4';

// Measured directly off the source video (2560x1440, 7.146s, 60fps) via
// accurate (non-keyframe) ffmpeg seeking, not the fast/keyframe-snapped seek
// mode -- that mode silently rounds to the nearest preceding keyframe and
// reads several tenths of a second off on this file, which previously made
// this range subtly wrong.
// - 0.0s-~1.1s reads as visually CLOSED (thin hairline cracks only).
// - Opening becomes clearly visible ~1.4-1.7s; by ~2.1s it already reads as
//   near-fully OPEN, holding through ~4.3s (widest fragment separation,
//   brightest exposed core).
// The progress range interpolates CLOSED_TIME -> FULL_OPEN_TIME directly, so
// smoothedProgress 0 always lands exactly on the closed frame. One
// deterministic range drives both directions (open by scrubbing forward,
// close by scrubbing backward) rather than the video's separate closing pass
// later in the timeline -- this guarantees the same visual path forward and
// back, so there is never a pop when reversing direction.
const CLOSED_TIME = 0.08;
const FULL_OPEN_TIME = 2.85;

// Interaction hit-area: a normalized ellipse over the stone itself (not the
// full 16:9 frame, most of which is empty background). Center is offset
// slightly above the geometric middle of the video box because the stone's
// own visual mass — and its grounding shadow — sit a little low in frame.
const HIT_CENTER_Y = 0.47;
const HIT_RADIUS_X = 0.4;
const HIT_RADIUS_Y = 0.38;
// Distance (in hit-area radii) at which target progress reaches zero. >1 so
// the outer ring just past the stone's edge still registers a soft ~15-20%
// open, per spec, before falling to fully closed.
const OUTER_FALLOFF = 1.32;

const OPEN_RATE = 0.16;
const CLOSE_RATE = 0.07;
const ACTIVATE_RATE = 0.4;
const ACTIVATE_TOTAL_MS = 420;
const TAP_MOVE_THRESHOLD_PX = 14;
const TAP_MAX_MS = 320;

export interface SeismicStoneVideoProps {
  href?: string;
  label?: string;
  /** Interaction stays disabled until the entrance choreography finishes. */
  interactive: boolean;
}

export function SeismicStoneVideo({
  href = '/p/modern-museum',
  label = 'Enter the Seismic Museum',
  interactive,
}: SeismicStoneVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hitAreaRef = useRef<HTMLButtonElement>(null);

  const metadataReadyRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const interactiveRef = useRef(interactive);
  const targetProgressRef = useRef(0);
  const smoothedProgressRef = useRef(0);
  const lastSetTimeRef = useRef(CLOSED_TIME);
  const activatingRef = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);
  const lastFrameAtRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const unlockedIOSRef = useRef(false);
  const navigateTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedMotionRef.current = query.matches;
    const onChange = () => {
      reducedMotionRef.current = query.matches;
    };
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onLoadedMetadata = () => {
      metadataReadyRef.current = true;
      try {
        video.currentTime = CLOSED_TIME;
      } catch {
        // Some browsers throw if metadata isn't fully settled yet; the RAF
        // loop below will correct the frame on its next tick regardless.
      }
    };
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    if (video.readyState >= 1) onLoadedMetadata();
    return () => {
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  // RAF loop: damped follow of targetProgress -> smoothedProgress -> a single
  // video.currentTime write per frame. Never seeks directly from pointer
  // events, and never re-renders React on pointer movement (refs only).
  useEffect(() => {
    lastFrameAtRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameAtRef.current) / 1000);
      lastFrameAtRef.current = now;

      const video = videoRef.current;
      if (video && metadataReadyRef.current && !reducedMotionRef.current) {
        const rate = activatingRef.current
          ? ACTIVATE_RATE
          : targetProgressRef.current > smoothedProgressRef.current
            ? OPEN_RATE
            : CLOSE_RATE;
        const factor = 1 - Math.pow(1 - rate, dt * 60);
        smoothedProgressRef.current +=
          (targetProgressRef.current - smoothedProgressRef.current) * factor;
        if (Math.abs(targetProgressRef.current - smoothedProgressRef.current) < 0.0006) {
          smoothedProgressRef.current = targetProgressRef.current;
        }

        const t = CLOSED_TIME + smoothedProgressRef.current * (FULL_OPEN_TIME - CLOSED_TIME);
        if (Math.abs(t - lastSetTimeRef.current) > 0.004) {
          try {
            video.currentTime = t;
          } catch {
            // Ignore transient seek errors (e.g. mid-seek on slower devices).
          }
          lastSetTimeRef.current = t;
        }

        const container = hitAreaRef.current;
        if (container) {
          // Extremely subtle lift + scale as the stone opens — never rotation
          // or perspective, the source video already provides the real motion.
          const p = smoothedProgressRef.current;
          container.style.setProperty('--stone-parallax-y', `${(-p * 3).toFixed(3)}px`);
          container.style.setProperty('--stone-parallax-scale', (1 + p * 0.008).toFixed(4));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateTargetFromClient = useCallback((clientX: number, clientY: number) => {
    const el = hitAreaRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width * 0.5;
    const cy = rect.top + rect.height * HIT_CENTER_Y;
    const nx = (clientX - cx) / (rect.width * HIT_RADIUS_X);
    const ny = (clientY - cy) / (rect.height * HIT_RADIUS_Y);
    const dist = Math.sqrt(nx * nx + ny * ny);
    const p = 1 - dist / OUTER_FALLOFF;
    targetProgressRef.current = Math.max(0, Math.min(1, p));
  }, []);

  const unlockIOSVideoOnce = useCallback(() => {
    if (unlockedIOSRef.current) return;
    unlockedIOSRef.current = true;
    const video = videoRef.current;
    if (!video) return;
    video
      .play()
      .then(() => {
        video.pause();
      })
      .catch(() => {
        // Autoplay-without-gesture rejection is expected here on some
        // browsers; scrubbing still works via currentTime regardless.
      });
  }, []);

  const handleActivate = useCallback(() => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    targetProgressRef.current = 1;
    if (reducedMotionRef.current) {
      window.location.assign(href);
      return;
    }
    navigateTimeout.current = setTimeout(() => {
      window.location.assign(href);
    }, ACTIVATE_TOTAL_MS);
  }, [href]);

  useEffect(
    () => () => {
      if (navigateTimeout.current !== undefined) clearTimeout(navigateTimeout.current);
    },
    [],
  );

  const handlePointerEnter = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!interactiveRef.current || activatingRef.current || event.pointerType === 'touch') return;
      updateTargetFromClient(event.clientX, event.clientY);
    },
    [updateTargetFromClient],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!interactiveRef.current || activatingRef.current || event.pointerType === 'touch') return;
      updateTargetFromClient(event.clientX, event.clientY);
    },
    [updateTargetFromClient],
  );

  const handlePointerLeave = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === 'touch') return;
    if (!activatingRef.current) targetProgressRef.current = 0;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLButtonElement>) => {
      if (!interactiveRef.current || activatingRef.current) return;
      unlockIOSVideoOnce();
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: performance.now() };
      updateTargetFromClient(touch.clientX, touch.clientY);
    },
    [updateTargetFromClient, unlockIOSVideoOnce],
  );

  const handleTouchMove = useCallback(
    (event: React.TouchEvent<HTMLButtonElement>) => {
      if (!interactiveRef.current || activatingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      updateTargetFromClient(touch.clientX, touch.clientY);
    },
    [updateTargetFromClient],
  );

  const handleTouchEnd = useCallback(
    (event: React.TouchEvent<HTMLButtonElement>) => {
      const start = touchStartRef.current;
      touchStartRef.current = null;
      if (!start || activatingRef.current) return;
      const touch = event.changedTouches[0];
      const dx = touch ? touch.clientX - start.x : 0;
      const dy = touch ? touch.clientY - start.y : 0;
      const moved = Math.hypot(dx, dy);
      const elapsed = performance.now() - start.t;
      if (moved < TAP_MOVE_THRESHOLD_PX && elapsed < TAP_MAX_MS) {
        handleActivate();
      } else {
        targetProgressRef.current = 0;
      }
    },
    [handleActivate],
  );

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
    <button
      ref={hitAreaRef}
      type="button"
      className={styles['hitArea']}
      aria-label={label}
      onPointerEnter={handlePointerEnter}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleActivate}
      onKeyDown={handleKeyDown}
    >
      <video
        ref={videoRef}
        className={styles['video']}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      />
    </button>
  );
}
