import { useEffect, useRef } from 'react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { skeleton, POSE_CONNECTIONS } from '../engine/skeleton';

const MIN_VIS = 0.3;

/**
 * Right-hand panel: draws the MediaPipe skeleton for the current frame, optionally
 * over a dimmed copy of the RGB frame (mirrored from the left display canvas). A
 * continuous rAF keeps it in lockstep with the left panel during play and scrub.
 */
export default function SkeletonCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const meta = useStore((s) => s.meta);
  const hasSkeleton = useStore((s) => s.hasSkeleton);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !meta) return;
    canvas.width = meta.width;
    canvas.height = meta.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let stopped = false;
    const w = canvas.width;
    const h = canvas.height;

    const render = () => {
      if (stopped) return;
      const s = useStore.getState();
      // mirror the frame actually painted on the RGB canvas (not the scrub target) so the
      // skeleton never lags the RGB during fast scrubbing
      const frame = engine.shownFrame;

      // backdrop: mirror the left RGB (dimmed) or black
      if (s.skeletonBackdrop && engine.displayCanvas) {
        try {
          ctx.drawImage(engine.displayCanvas, 0, 0, w, h);
        } catch {
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.fillStyle = 'rgba(8,10,14,0.55)';
        ctx.fillRect(0, 0, w, h);
      } else {
        ctx.fillStyle = '#05070a';
        ctx.fillRect(0, 0, w, h);
      }

      const lm = skeleton.frame(frame);
      if (!lm) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = `${Math.round(h / 28)}px -apple-system, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(hasSkeleton ? 'no pose detected this frame' : 'no skeleton loaded', w / 2, h / 2);
        ctx.textAlign = 'left';
      } else {
        // connections
        const S = skeleton.data?.stride ?? 3; // values per landmark (3 or 4); confidence is the last
        ctx.lineWidth = Math.max(2, w / 320);
        ctx.lineCap = 'round';
        for (const [a, b] of POSE_CONNECTIONS) {
          const av = lm[a * S + S - 1];
          const bv = lm[b * S + S - 1];
          if (av < MIN_VIS || bv < MIN_VIS) continue;
          ctx.strokeStyle = `rgba(79,209,255,${Math.min(1, Math.min(av, bv) + 0.2)})`;
          ctx.beginPath();
          ctx.moveTo(lm[a * S] * w, lm[a * S + 1] * h);
          ctx.lineTo(lm[b * S] * w, lm[b * S + 1] * h);
          ctx.stroke();
        }
        // joints
        const r = Math.max(3, w / 240);
        for (let i = 0; i < lm.length / S; i++) {
          const v = lm[i * S + S - 1];
          if (v < MIN_VIS) continue;
          ctx.fillStyle = `rgba(255,210,63,${Math.min(1, v + 0.2)})`;
          ctx.beginPath();
          ctx.arc(lm[i * S] * w, lm[i * S + 1] * h, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // flagged-frame highlight
      const flag = s.poseErrors[frame];
      if (flag) {
        ctx.strokeStyle = '#ff5c6c';
        ctx.lineWidth = Math.max(4, w / 160);
        ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, w - ctx.lineWidth, h - ctx.lineWidth);
      }

      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [meta, hasSkeleton]);

  if (!meta) return null;
  return (
    <div className="skeleton-canvas-wrap">
      <canvas ref={canvasRef} className="skeleton-canvas" />
      <span className="skeleton-badge">MediaPipe pose</span>
    </div>
  );
}
