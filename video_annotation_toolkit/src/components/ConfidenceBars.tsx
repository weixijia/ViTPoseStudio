import { useEffect, useRef } from 'react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { skeleton, LANDMARK_NAMES } from '../engine/skeleton';

// landmark groups (face / upper body / lower body) — drawn with a gap between them
const GROUPS: ReadonlyArray<readonly [number, number]> = [[0, 10], [11, 22], [23, 32]];
const PAD_X = 6;
const GAP = 8;
const LOW = 0.5;

/**
 * A quiet per-keypoint confidence meter under the skeleton. Each MediaPipe landmark's
 * visibility (0..1) is a bar; high-confidence bars are dim so they don't compete with the
 * RGB/skeleton, while low-confidence ones glow amber/red to flag where the pose is unreliable.
 * Hover a bar to read its keypoint name + score. Synced to the displayed frame (engine.shownFrame).
 */
export default function ConfidenceBars() {
  const meta = useStore((s) => s.meta);
  const hasSkeleton = useStore((s) => s.hasSkeleton);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const statusRef = useRef<HTMLSpanElement>(null);
  const hoverRef = useRef(-1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !meta || !hasSkeleton) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    let stopped = false;

    const render = () => {
      if (stopped) return;
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const d = skeleton.data;
      const N = d?.numLandmarks ?? 33;
      const S = d?.stride ?? 3;
      const lm = skeleton.frame(engine.shownFrame);
      const usableH = h - 6;
      const y0 = h - 2;
      const totalGap = GAP * (GROUPS.length - 1);
      const bw = Math.max(1.5, (w - PAD_X * 2 - totalGap) / N);

      // baseline + 0.5 threshold guide
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.moveTo(PAD_X, y0 + 0.5); ctx.lineTo(w - PAD_X, y0 + 0.5); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.09)';
      ctx.setLineDash([3, 3]);
      const ty = y0 - LOW * usableH;
      ctx.beginPath(); ctx.moveTo(PAD_X, ty); ctx.lineTo(w - PAD_X, ty); ctx.stroke();
      ctx.setLineDash([]);

      if (!lm) {
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText('no pose this frame', PAD_X, h / 2);
        if (statusRef.current) statusRef.current.textContent = '';
        raf = requestAnimationFrame(render);
        return;
      }

      let x = PAD_X;
      let sum = 0;
      let low = 0;
      for (const [a, b] of GROUPS) {
        for (let i = a; i <= b; i++) {
          const conf = lm[i * S + S - 1];
          sum += conf;
          if (conf < LOW) low++;
          const bh = Math.max(1, conf * usableH);
          ctx.fillStyle =
            i === hoverRef.current
              ? '#ffffff'
              : conf < 0.4
                ? 'rgba(255,92,108,0.95)'
                : conf < 0.7
                  ? 'rgba(255,196,0,0.85)'
                  : 'rgba(120,170,210,0.4)';
          ctx.fillRect(x, y0 - bh, Math.max(1, bw - 1), bh);
          x += bw;
        }
        x += GAP;
      }

      if (statusRef.current) {
        statusRef.current.textContent =
          hoverRef.current >= 0
            ? `${LANDMARK_NAMES[hoverRef.current] ?? hoverRef.current} · ${lm[hoverRef.current * S + S - 1].toFixed(2)}`
            : `mean ${(sum / N).toFixed(2)} · ${low} low`;
      }
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }, [meta, hasSkeleton]);

  const onMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const d = skeleton.data;
    if (!canvas || !d) return;
    const rect = canvas.getBoundingClientRect();
    const N = d.numLandmarks;
    const totalGap = GAP * (GROUPS.length - 1);
    const bw = (rect.width - PAD_X * 2 - totalGap) / N;
    let px = e.clientX - rect.left - PAD_X;
    let cursor = 0;
    let found = -1;
    for (const [a, b] of GROUPS) {
      const cnt = b - a + 1;
      const groupW = cnt * bw;
      if (px >= cursor && px < cursor + groupW) {
        found = a + Math.floor((px - cursor) / bw);
        break;
      }
      cursor += groupW + GAP;
    }
    hoverRef.current = found;
  };

  if (!meta || !hasSkeleton) return null;
  return (
    <div className="confidence-bars">
      <div className="cb-head">
        <span>keypoint confidence</span>
        <span className="cb-readout" ref={statusRef} />
      </div>
      <canvas ref={canvasRef} className="cb-canvas" onMouseMove={onMove} onMouseLeave={() => (hoverRef.current = -1)} />
    </div>
  );
}
