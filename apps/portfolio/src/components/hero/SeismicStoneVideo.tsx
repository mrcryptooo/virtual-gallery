import { useCallback, useEffect, useRef } from 'react';
import styles from './SeismicStoneVideo.module.css';

/**
 * Seismic Stone hero — the reference video itself is the visual asset (no
 * WebGL reconstruction), rendered as a fixed, full-viewport background layer
 * (object-fit: cover) so there is no visible video rectangle against the
 * page. The stone's open/closed state is driven entirely by scrubbing
 * `video.currentTime` across a single deterministic CLOSED→OPEN range,
 * smoothed by a damped pointer-following target so it feels tactile rather
 * than "hover = play". A separate, invisible hit-area element (sized to
 * match the video's own on-screen cover geometry, see .hitArea in the CSS)
 * carries all pointer/touch/keyboard handling — the full-bleed video itself
 * is never the interactive surface, since most of its frame is empty field
 * around the stone.
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
// full video frame, most of which is empty background). Center is offset
// slightly above the geometric middle because the stone's own visual mass —
// and its grounding shadow — sit a little low in frame.
const HIT_CENTER_Y = 0.47;
const HIT_RADIUS_X = 0.4;
const HIT_RADIUS_Y = 0.38;
// Distance (in hit-area radii) at which target progress reaches zero. >1 so
// the outer ring just past the stone's edge still registers a soft ~15-20%
// open, per spec, before falling to fully closed.
const OUTER_FALLOFF = 1.32;
// Dead-zone: pointer moves smaller than this (device px) since the last
// accepted sample are ignored outright, so sub-pixel mouse tremor can't
// perturb the target even before smoothing gets to it.
const MOVE_DEAD_ZONE_PX = 3;

// Tuned for a "directly controlled but never twitchy" feel: opening responds
// noticeably faster than closing, so the stone reads as eager to react but
// settles rather than snapping shut the instant the pointer drifts.
const OPEN_RATE = 0.15;
const CLOSE_RATE = 0.085;
const ACTIVATE_TOTAL_MS = 420;
const TAP_MOVE_THRESHOLD_PX = 14;
const TAP_MAX_MS = 320;
// Deliberately mid-range -- audible as an intentional beat without being
// jarring against whatever the visitor already has playing.
const ACTIVATE_VOLUME = 0.45;

export interface SeismicStoneVideoProps {
  href?: string;
  label?: string;
  /** Interaction stays disabled until the entrance choreography finishes. */
  interactive: boolean;
  /** Drives the video's own entrance fade-in (first step of the choreography). */
  revealed?: boolean;
}

export function SeismicStoneVideo({
  href = '/p/modern-museum',
  label = 'Enter the Seismic Museum',
  interactive,
  revealed = true,
}: SeismicStoneVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hitAreaRef = useRef<HTMLButtonElement>(null);

  const metadataReadyRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const interactiveRef = useRef(interactive);
  const targetProgressRef = useRef(0);
  const smoothedProgressRef = useRef(0);
  const lastSetTimeRef = useRef(CLOSED_TIME);
  const lastSampleClientRef = useRef<{ x: number; y: number } | null>(null);
  const activatingRef = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);
  const lastFrameAtRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const audioUnlockedRef = useRef(false);
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
  // Suspended entirely while activating -- that phase hands the video to
  // real playback (see handleActivate) so the audible entry beat and the
  // manual seek loop never fight over currentTime.
  useEffect(() => {
    lastFrameAtRef.current = performance.now();

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastFrameAtRef.current) / 1000);
      lastFrameAtRef.current = now;

      const video = videoRef.current;
      if (
        video &&
        metadataReadyRef.current &&
        !reducedMotionRef.current &&
        !activatingRef.current
      ) {
        const rate =
          targetProgressRef.current > smoothedProgressRef.current ? OPEN_RATE : CLOSE_RATE;
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

        // Extremely subtle lift + scale as the stone opens — never rotation
        // or perspective, the source video already provides the real motion.
        // Applied to the full-bleed video itself: object-fit: cover already
        // crops beyond the viewport on at least one axis, so a few px of
        // extra scale/shift only deepens that existing crop margin and can
        // never expose an edge.
        const p = smoothedProgressRef.current;
        video.style.setProperty('--stone-parallax-y', `${(-p * 3).toFixed(3)}px`);
        video.style.setProperty('--stone-parallax-scale', (1 + p * 0.008).toFixed(4));
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const updateTargetFromClient = useCallback((clientX: number, clientY: number) => {
    const last = lastSampleClientRef.current;
    if (last && Math.hypot(clientX - last.x, clientY - last.y) < MOVE_DEAD_ZONE_PX) return;
    lastSampleClientRef.current = { x: clientX, y: clientY };

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

  // Unmuting itself never requires a user gesture (only an unmuted *play()*
  // call does) -- doing it as early as the first hover/touch just means the
  // later, gesture-backed play() call in handleActivate is already primed.
  // Idempotent and cheap, so it's safe to call from every pointer/touch entry
  // handler rather than threading a single "first interaction" event.
  const unlockAudioOnce = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    video.volume = ACTIVATE_VOLUME;
  }, []);

  const handleActivate = useCallback(() => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    targetProgressRef.current = 1;
    const video = videoRef.current;
    if (reducedMotionRef.current) {
      window.location.assign(href);
      return;
    }
    if (video) {
      // Hand the frame to real playback for the entry beat only -- this is
      // the one moment the video actually plays (rather than being seeked
      // while paused), which is what makes it audible, and why normal
      // hover-scrub interaction never produces sound: a paused video seek
      // is always silent on every browser, so there is nothing to "chop" or
      // duck during ordinary scrubbing by construction.
      video.muted = false;
      video.volume = ACTIVATE_VOLUME;
      video.play().catch(() => {
        // Autoplay/gesture rejection on some browsers -- the timed
        // navigation below still fires regardless, just silently.
      });
    }
    navigateTimeout.current = setTimeout(() => {
      video?.pause();
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
      if (event.pointerType === 'touch') return;
      unlockAudioOnce();
      if (!interactiveRef.current || activatingRef.current) return;
      updateTargetFromClient(event.clientX, event.clientY);
    },
    [updateTargetFromClient, unlockAudioOnce],
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
    lastSampleClientRef.current = null;
    if (!activatingRef.current) targetProgressRef.current = 0;
  }, []);

  const handleTouchStart = useCallback(
    (event: React.TouchEvent<HTMLButtonElement>) => {
      unlockAudioOnce();
      if (!interactiveRef.current || activatingRef.current) return;
      const touch = event.touches[0];
      if (!touch) return;
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, t: performance.now() };
      updateTargetFromClient(touch.clientX, touch.clientY);
    },
    [updateTargetFromClient, unlockAudioOnce],
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
    <>
      <video
        ref={videoRef}
        className={styles['backgroundVideo']}
        data-revealed={revealed}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      />
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
      />
    </>
  );
}
