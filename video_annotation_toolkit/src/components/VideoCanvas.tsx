import { useEffect, useRef } from 'react';
import { engine } from '../engine/engineInstance';
import { useStore } from '../state/useStore';

/**
 * Owns the single display canvas. While PAUSED it decodes and paints the exact
 * current frame (frame-accurate). While PLAYING it yields the canvas to the play
 * loop (which blits decoded frames directly), so this effect is gated off.
 */
export default function VideoCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meta = useStore((s) => s.meta);
  const currentFrame = useStore((s) => s.currentFrame);
  const isPlaying = useStore((s) => s.isPlaying);
  const reqToken = useRef(0);

  // register the canvas with the engine (play loop blits onto it) + size it
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !meta) return;
    canvas.width = meta.width;
    canvas.height = meta.height;
    engine.displayCanvas = canvas;
    return () => {
      if (engine.displayCanvas === canvas) engine.displayCanvas = null;
    };
  }, [meta]);

  useEffect(() => {
    if (!meta || isPlaying) return; // play loop owns the canvas while playing
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const token = ++reqToken.current;
    let cancelled = false;
    engine
      .getFrameCanvas(currentFrame)
      .then((frameCanvas) => {
        if (cancelled || token !== reqToken.current || !frameCanvas) return;
        ctx.drawImage(frameCanvas, 0, 0, canvas.width, canvas.height);
      })
      .catch(() => {
        /* single-frame decode errors are non-fatal */
      });
    return () => {
      cancelled = true;
    };
  }, [currentFrame, meta, isPlaying]);

  if (!meta) return null;
  return (
    <div className="video-canvas-wrap">
      <canvas ref={canvasRef} className="video-canvas" />
    </div>
  );
}
