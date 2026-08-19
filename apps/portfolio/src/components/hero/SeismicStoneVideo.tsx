import { useCallback, useEffect, useRef } from 'react';
import styles from './SeismicStoneVideo.module.css';

/**
 * Seismic Stone hero — the reference video itself is the visual asset (no
 * WebGL reconstruction), rendered as a fixed, full-viewport background
 * (object-fit: cover), scaled down slightly (STONE_SCALE) to reduce the
 * stone's apparent size, with its edges masked into a same-source blurred
 * ring layer (.backgroundVideoBlurRing) and finally a plain CSS field
 * (LandingPage.module.css .field) behind everything — see the mask-ellipse
 * note atop SeismicStoneVideo.module.css for how that blend is built, so
 * there is no visible video rectangle against the page. The stone's
 * open/closed state is driven entirely by scrubbing `video.currentTime`
 * across a single deterministic CLOSED→OPEN range, smoothed by a damped
 * pointer-following target so it feels tactile rather than "hover = play".
 * A separate, invisible hit-area element (scaled in lockstep with the
 * video, see .hitArea in the CSS) carries all pointer/touch/keyboard
 * handling — the full-bleed video itself is never the interactive surface,
 * since most of its frame is empty field around the stone.
 *
 * Video encoding: the shipped asset is a scrub-optimized re-encode of the
 * owner-supplied source (same visual content, duration, resolution, and
 * audio track — see content-src/seismic-stone/ for the original), with a
 * short GOP (~4 frames instead of the original's ~53-frame GOP) so seeking
 * to an arbitrary point never has to decode dozens of inter-frames first.
 * That was the actual root cause of the scrub stutter reported earlier, not
 * the JS damping (measured via ffprobe frame pict_type distribution, then
 * confirmed by an SSIM diff between original and re-encode: ~0.99 mean,
 * visually equivalent). File size dropped from ~42MB to ~14MB in the
 * process, as a side effect of the source's original bitrate being far
 * higher than the content needs.
 */

const VIDEO_SRC = '/hero/seismic-stone.mp4';

// Measured directly off the source video (2560x1440, ~7.15s, 60fps) via
// accurate (non-keyframe) ffmpeg seeking, not the fast/keyframe-snapped seek
// mode -- that mode silently rounds to the nearest preceding keyframe and
// reads several tenths of a second off on this file.
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
// Only write video.currentTime when the desired seek differs from the last
// applied one by more than this. 1/90s: sub-frame at the source's 60fps (a
// full frame is 1/60s), so it never visibly rounds, but still skips the
// large fraction of RAF ticks where damping has only moved the value by an
// imperceptible fraction of a frame.
const SEEK_EPSILON = 1 / 90;

// Reduces the stone's on-screen scale (~30% smaller than the previous
// production size: 0.83 * 0.70 ≈ 0.58) without reintroducing a boxed video:
// the video element itself stays sized to the full viewport (for the cover
// math and the hit-area's matching geometry below), and is scaled down in
// place via CSS transform around its own center; a same-source blurred ring
// (see SeismicStoneVideo.module.css) fills the extra margin this exposes.
// The hit-area is scaled identically so the invisible interaction region
// always matches what's actually drawn -- both live in the CSS file since
// this constant only documents the value, it isn't read at runtime.
export const STONE_SCALE = 0.58;

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
// Second dead-zone, on the resulting progress value itself (not just raw
// pointer px): guards against the hit-area's own geometry amplifying a
// small pointer move into a larger progress delta near the ellipse's edge.
const PROGRESS_EPSILON = 0.002;

// Tuned for a "directly controlled but never twitchy" feel: opening responds
// noticeably faster than closing, so the stone reads as eager to react but
// settles rather than snapping shut the instant the pointer drifts. Both are
// frame-rate-independent exponential damping factors (applied as
// `1 - (1-rate)^(dt*60)`), not per-frame constants -- the perceived speed is
// the same at 30fps, 60fps, or a stalled/throttled tab.
const OPEN_RATE = 0.15;
const CLOSE_RATE = 0.085;
// Second smoothing stage: raw pointer -> targetProgress -> smoothedProgress
// (above) -> displayProgress (this) -> desired video time. A single extra
// damped follow removes the last bit of high-frequency jitter a single
// exponential filter alone still lets through on fast, noisy pointer
// input (mouse micro-jitter, trackpad noise), without adding perceptible
// lag -- it's fast enough to still read as "directly connected" to the
// pointer, just smoother in the small.
const DISPLAY_RATE = 0.4;
const DISPLAY_EPSILON = 0.0015;
const ACTIVATE_TOTAL_MS = 420;
const TAP_MOVE_THRESHOLD_PX = 14;
const TAP_MAX_MS = 320;

// ── Audio ────────────────────────────────────────────────────────────────
// A separate <audio> element (same source file -- browsers happily play
// just the audio track of an MP4 through <audio>) rather than unmuting the
// background <video>: the video is only ever seeked while paused, which is
// silent on every browser by construction, so it can never produce chopped
// seek-audio. The <audio> element instead really plays, decoupled from the
// seek-driven video, so "the stone's sound during opening" is continuous,
// clean playback rather than scrubbed audio -- there is nothing to duck.
// Deliberately mid-range -- audible as an intentional cue without being
// jarring against whatever the visitor already has playing.
const AUDIO_VOLUME = 0.45;
// Hysteresis band: must open past OPEN to *start* audio, must close back
// below CLOSE to *stop* it -- a wider gap than the pointer dead-zone alone,
// so audio never starts/stops/restarts on small back-and-forth pointer
// motion near a single threshold.
const AUDIO_OPEN_THRESHOLD = 0.1;
const AUDIO_CLOSE_THRESHOLD = 0.045;
const AUDIO_VOLUME_RATE = 0.12;
const AUDIO_FADE_OUT_RATE = 0.05;

export interface SeismicStoneVideoProps {
  href?: string;
  label?: string;
  /** Interaction stays disabled until the entrance choreography finishes. */
  interactive: boolean;
  /** Drives the video's own entrance fade-in (first step of the choreography). */
  revealed?: boolean;
  /** SOUND OFF must be absolutely silent regardless of open progress. */
  soundEnabled?: boolean;
  /** Fires once on the first genuine pointer/touch gesture, for audio-unlock bookkeeping owned by the parent (e.g. the sound toggle's own first click). */
  onFirstInteraction?: () => void;
}

export function SeismicStoneVideo({
  href = '/p/modern-museum',
  label = 'Enter the Seismic Museum',
  interactive,
  revealed = true,
  soundEnabled = true,
  onFirstInteraction,
}: SeismicStoneVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const backdropVideoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const hitAreaRef = useRef<HTMLButtonElement>(null);

  const metadataReadyRef = useRef(false);
  const reducedMotionRef = useRef(false);
  const interactiveRef = useRef(interactive);
  const soundEnabledRef = useRef(soundEnabled);
  const targetProgressRef = useRef(0);
  const smoothedProgressRef = useRef(0);
  const displayProgressRef = useRef(0);
  const lastSetTimeRef = useRef(CLOSED_TIME);
  const lastSampleClientRef = useRef<{ x: number; y: number } | null>(null);
  const activatingRef = useRef(false);
  const rafRef = useRef<number | undefined>(undefined);
  const lastFrameAtRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);
  const audioUnlockedRef = useRef(false);
  const audioPlayingRef = useRef(false);
  const navigateTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    interactiveRef.current = interactive;
  }, [interactive]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
    if (!soundEnabled) {
      // SOUND OFF must be immediate and absolute -- don't wait for the RAF
      // fade-out to notice on its next tick.
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.volume = 0;
      }
      audioPlayingRef.current = false;
    }
  }, [soundEnabled]);

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

  // The blurred backdrop is the exact same source, just scaled up and
  // heavily blurred (see .backdropVideo) -- kept in sync below so it always
  // shows the same moment as the sharp foreground. Because it's literally
  // the same footage, its color and grain always match by construction;
  // this replaced an earlier hand-tuned CSS gradient + noise-texture
  // attempt at approximating the video's edge tone, which still left a
  // faint but visible seam no amount of tuning fully closed.
  useEffect(() => {
    const backdrop = backdropVideoRef.current;
    if (!backdrop) return;
    const onLoadedMetadata = () => {
      try {
        backdrop.currentTime = CLOSED_TIME;
      } catch {
        // Corrected on the next RAF sync tick regardless.
      }
    };
    backdrop.addEventListener('loadedmetadata', onLoadedMetadata);
    if (backdrop.readyState >= 1) onLoadedMetadata();
    return () => {
      backdrop.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, []);

  // RAF loop: damped follow of targetProgress -> smoothedProgress -> a single
  // video.currentTime write per frame, plus the audio volume/play-state
  // that follows the same smoothed progress. Never seeks directly from
  // pointer events, and never re-renders React on pointer movement (refs
  // only). The video-seek portion is suspended entirely while activating --
  // that phase hands the video to real playback-free stillness (audio
  // carries the entry beat instead) so nothing fights over currentTime.
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
        if (Math.abs(targetProgressRef.current - smoothedProgressRef.current) < PROGRESS_EPSILON) {
          smoothedProgressRef.current = targetProgressRef.current;
        }

        // Second stage: raw pointer -> targetProgress -> smoothedProgress
        // (above) -> displayProgress (here) -> desired video time. This is
        // what actually drives playback -- a second damped follow catches
        // the residual high-frequency noise a single exponential filter
        // passes through on fast/noisy pointer input.
        const displayFactor = 1 - Math.pow(1 - DISPLAY_RATE, dt * 60);
        displayProgressRef.current +=
          (smoothedProgressRef.current - displayProgressRef.current) * displayFactor;
        if (Math.abs(smoothedProgressRef.current - displayProgressRef.current) < DISPLAY_EPSILON) {
          displayProgressRef.current = smoothedProgressRef.current;
        }

        const t = CLOSED_TIME + displayProgressRef.current * (FULL_OPEN_TIME - CLOSED_TIME);
        if (Math.abs(t - lastSetTimeRef.current) > SEEK_EPSILON) {
          try {
            video.currentTime = t;
          } catch {
            // Ignore transient seek errors (e.g. mid-seek on slower devices).
          }
          const backdrop = backdropVideoRef.current;
          if (backdrop) {
            try {
              backdrop.currentTime = t;
            } catch {
              // Ignore transient seek errors.
            }
          }
          lastSetTimeRef.current = t;
        }

        // Extremely subtle lift as the stone opens — never rotation or
        // perspective, the source video already provides the real motion.
        // Scale itself stays fixed at STONE_SCALE (the size reduction); this
        // just nudges within that, and object-fit: cover's existing crop
        // margin absorbs it without ever exposing an edge.
        const p = displayProgressRef.current;
        video.style.setProperty('--stone-parallax-y', `${(-p * 3).toFixed(3)}px`);
      }

      // Audio follows the same smoothed progress (or a forced 1 while
      // activating, so the entry beat is reliably audible even from a cold
      // closed click). Runs unconditionally -- independent of the video-seek
      // gate above -- since it must still fade out cleanly under
      // reduced-motion or mid-activation.
      const audio = audioRef.current;
      if (audio) {
        const p = !soundEnabledRef.current
          ? 0
          : activatingRef.current
            ? 1
            : reducedMotionRef.current
              ? 0
              : displayProgressRef.current;
        const wantPlaying =
          p > (audioPlayingRef.current ? AUDIO_CLOSE_THRESHOLD : AUDIO_OPEN_THRESHOLD);

        if (wantPlaying && !audioPlayingRef.current && audioUnlockedRef.current) {
          audioPlayingRef.current = true;
          try {
            audio.currentTime = CLOSED_TIME;
          } catch {
            // Ignore transient seek errors.
          }
          audio.volume = 0;
          audio.play().catch(() => {
            // Autoplay/gesture rejection -- audioPlayingRef stays true so
            // the volume ramp below still tries; harmless no-op if it never
            // actually starts.
          });
        } else if (!wantPlaying && audioPlayingRef.current) {
          audioPlayingRef.current = false;
        }

        if (audioPlayingRef.current) {
          const targetVolume = AUDIO_VOLUME * Math.min(1, p / AUDIO_OPEN_THRESHOLD);
          audio.volume += (targetVolume - audio.volume) * AUDIO_VOLUME_RATE;
        } else if (audio.volume > 0.004) {
          audio.volume += (0 - audio.volume) * AUDIO_FADE_OUT_RATE;
        } else if (!audio.paused) {
          audio.volume = 0;
          audio.pause();
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

  // Unmuting/priming itself never requires a user gesture (only an unmuted
  // *play()* call does) -- doing it as early as the first hover/touch just
  // means the later, gesture-backed play() call is already primed. Cheap
  // and idempotent, so safe to call from every pointer/touch entry handler.
  const unlockAudioOnce = useCallback(() => {
    if (audioUnlockedRef.current) return;
    audioUnlockedRef.current = true;
    onFirstInteraction?.();
  }, [onFirstInteraction]);

  const handleActivate = useCallback(() => {
    if (activatingRef.current) return;
    activatingRef.current = true;
    targetProgressRef.current = 1;
    smoothedProgressRef.current = 1;
    displayProgressRef.current = 1;
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
        ref={backdropVideoRef}
        className={styles['backgroundVideoBlurRing']}
        data-revealed={revealed}
        src={VIDEO_SRC}
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
      />
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
      {/* Decorative ambient sound effect only (no speech/dialogue), on a
          hidden element the assistive-tech tree never exposes -- there is
          no caption content to provide. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={VIDEO_SRC} preload="auto" aria-hidden="true" tabIndex={-1} />
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
