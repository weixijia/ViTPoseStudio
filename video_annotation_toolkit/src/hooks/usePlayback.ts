import { useEffect } from 'react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { playLoop } from '../engine/PlayLoop';

/**
 * Playback driver.
 *  - Forward (speed > 0): Mediabunny's sequential canvas iterator (smooth, decodes
 *    in order) blits straight to the display canvas.
 *  - Reverse (speed < 0, the J shuttle): a wall-clock rAF loop that seeks each target
 *    frame (acceptable for reverse scrubbing).
 * While paused, VideoCanvas owns the display and shows the exact current frame.
 */
export function usePlayback() {
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);

  useEffect(() => {
    if (!isPlaying) {
      playLoop.stop();
      return;
    }
    const meta = useStore.getState().meta;
    const file = engine.file;
    const canvas = engine.displayCanvas;
    if (!meta || !file || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---------- forward: sequential decode ----------
    // Invariant: every user/programmatic seek pauses first (setPlaying(false)),
    // which tears down this loop. So PlayLoop never needs to react to mid-play
    // currentFrame changes — onFrame's own writes must NOT restart it.
    if (speed > 0) {
      const startSec = engine.timeOfFrame(useStore.getState().currentFrame);
      // already at the end → nothing to play
      if (useStore.getState().currentFrame >= meta.frameCount - 1) {
        useStore.getState().setPlaying(false);
        return;
      }
      playLoop.run(
        file,
        startSec,
        speed,
        ctx,
        canvas.width,
        canvas.height,
        (t) => useStore.getState().setCurrentFrame(engine.frameAtTime(t)),
        () => useStore.getState().setPlaying(false),
      );
      return () => playLoop.stop();
    }

    // ---------- reverse: wall-clock seek loop ----------
    const startWall = performance.now();
    const startFrame = useStore.getState().currentFrame;
    const fps = meta.fps;
    let raf = 0;
    let cancelled = false;
    let decoding = false;
    let lastDrawn = -1;

    const loop = () => {
      if (cancelled) return;
      const elapsedSec = ((performance.now() - startWall) / 1000) * speed; // negative
      const target = startFrame + Math.trunc(elapsedSec * fps);
      // reverse stop guard — only when actually reaching/ passing frame 0
      if (target <= 0) {
        useStore.getState().setCurrentFrame(0);
        useStore.getState().setPlaying(false);
        return;
      }
      if (target !== lastDrawn && !decoding) {
        decoding = true;
        lastDrawn = target;
        useStore.getState().setCurrentFrame(target);
        engine
          .getFrameCanvas(target)
          .then((fc) => {
            if (!cancelled && fc) ctx.drawImage(fc, 0, 0, canvas.width, canvas.height);
          })
          .finally(() => {
            decoding = false;
          });
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [isPlaying, speed]);
}
