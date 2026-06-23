import { useEffect } from 'react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { playLoop } from '../engine/PlayLoop';
import { audioPlayer } from '../engine/AudioPlayer';

/**
 * Playback driver.
 *  - Forward (speed > 0): the file's audio plays natively via <audio> and acts as
 *    the master clock; Mediabunny's sequential canvas iterator decodes video frames
 *    and is paced to that audio clock (falls back to a wall clock if audio can't play).
 *  - Reverse (speed < 0, J shuttle): silent wall-clock rAF loop that seeks each frame.
 * While paused, VideoCanvas owns the display and shows the exact current frame.
 */
export function usePlayback() {
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const muted = useStore((s) => s.muted);
  const currentFrame = useStore((s) => s.currentFrame);

  // keep the <audio> mute in sync with the toggle, live
  useEffect(() => {
    audioPlayer.setMuted(muted);
  }, [muted]);

  // while paused, keep audio's position aligned with the playhead so the next
  // play starts in sync (no-op during playback)
  useEffect(() => {
    if (!useStore.getState().isPlaying) audioPlayer.seek(engine.timeOfFrame(currentFrame));
  }, [currentFrame]);

  useEffect(() => {
    if (!isPlaying) {
      playLoop.stop();
      audioPlayer.pause();
      return;
    }
    const meta = useStore.getState().meta;
    const canvas = engine.displayCanvas;
    if (!meta || !engine.mediaUrl || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---------- forward: audio-synced sequential decode ----------
    // Invariant: every user/programmatic seek pauses first (setPlaying(false)),
    // which tears down this loop. So PlayLoop never needs to react to mid-play
    // currentFrame changes — onFrame's own writes must NOT restart it.
    if (speed > 0) {
      const startSec = engine.timeOfFrame(useStore.getState().currentFrame);
      if (useStore.getState().currentFrame >= meta.frameCount - 1) {
        useStore.getState().setPlaying(false);
        return;
      }
      // start audio (best effort); video paces to it when it's actually playing
      void audioPlayer.play(startSec, speed, useStore.getState().muted);
      const getClock = () => (audioPlayer.isPlaying() ? audioPlayer.currentTime : null);
      playLoop.run(
        () => engine.createInput(),
        startSec,
        speed,
        ctx,
        canvas.width,
        canvas.height,
        (t) => {
          const fr = engine.frameAtTime(t);
          engine.shownFrame = fr;
          useStore.getState().setCurrentFrame(fr);
        },
        () => useStore.getState().setPlaying(false),
        getClock,
      );
      return () => {
        playLoop.stop();
        audioPlayer.pause();
      };
    }

    // ---------- reverse: silent wall-clock seek loop ----------
    audioPlayer.pause();
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
      const target = Math.max(0, startFrame + Math.trunc(elapsedSec * fps));
      if (target <= 0) {
        useStore.getState().setCurrentFrame(0);
        useStore.getState().setPlaying(false);
        return;
      }
      if (target !== lastDrawn && !decoding) {
        decoding = true;
        lastDrawn = target;
        engine
          .getFrameCanvas(target)
          .then((fc) => {
            if (cancelled) return;
            if (fc) ctx.drawImage(fc, 0, 0, canvas.width, canvas.height);
            // advance the playhead only after the frame is painted (matches forward path)
            engine.shownFrame = target;
            useStore.getState().setCurrentFrame(target);
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
