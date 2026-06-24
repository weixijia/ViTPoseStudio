import { useCallback, useEffect, useRef } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { rulerStep, formatRulerLabel, snapTime } from '../utils/ruler';
import type { Rep } from '../types';

// fixed band heights (px)
const RULER_H = 24;
const CLIP_H = 40;
const LANE_H = 48;
const CANVAS_H = RULER_H + CLIP_H + LANE_H; // 112
const CLIP_TOP = RULER_H;
const LANE_TOP = RULER_H + CLIP_H;
const EDGE_PX = 7; // segment edge grab zone (screen px)

/** Deterministic, well-spaced color per action id. */
function actionHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 360;
  return h;
}

type DragMode = 'scrub' | 'resizeStart' | 'resizeEnd' | 'moveRep';
interface DragState {
  mode: DragMode;
  repId?: string;
  grabOffsetFrames?: number;
  moved: boolean;
  pointerId: number;
}

export default function Timeline() {
  const meta = useStore((s) => s.meta);
  const pxPerSec = useStore((s) => s.pxPerSec);
  const fitZoom = useStore((s) => s.fitZoom);
  const maxPxPerSec = useStore((s) => s.maxPxPerSec);
  const reps = useStore((s) => s.reps);
  const inPoint = useStore((s) => s.inPoint);
  const outPoint = useStore((s) => s.outPoint);
  const selectedRepId = useStore((s) => s.selectedRepId);
  const currentFrame = useStore((s) => s.currentFrame);
  const isPlaying = useStore((s) => s.isPlaying);
  const snapEnabled = useStore((s) => s.snapEnabled);
  const followMode = useStore((s) => s.followMode);

  const scrollRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playheadRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const snapGuideRef = useRef<number | null>(null);
  const altRef = useRef(false);
  const prevPxRef = useRef(0); // 0 → the initial 0→default transition intentionally skips anchoring
  const zoomFocusRef = useRef<{ time: number; screenX: number } | null>(null);
  const rafRef = useRef(0);

  const dur = meta?.durationSec ?? 0;
  const fps = meta?.fps ?? 30;
  const contentWidth = Math.max(1, dur * pxPerSec);

  // ---- coordinate helpers ----
  const frameToContentX = useCallback((f: number) => engine.timeOfFrame(f) * pxPerSec, [pxPerSec]);
  const clientXToTime = useCallback(
    (clientX: number) => {
      const sc = scrollRef.current;
      if (!sc) return 0;
      const rect = sc.getBoundingClientRect();
      return Math.max(0, Math.min(dur, (clientX - rect.left + sc.scrollLeft) / pxPerSec));
    },
    [pxPerSec, dur],
  );

  // ---- draw ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const sc = scrollRef.current;
    if (!canvas || !sc || !meta) return;
    const dpr = window.devicePixelRatio || 1;
    const viewW = sc.clientWidth;
    if (canvas.width !== viewW * dpr || canvas.height !== CANVAS_H * dpr) {
      canvas.width = viewW * dpr;
      canvas.height = CANVAS_H * dpr;
      canvas.style.width = `${viewW}px`;
      canvas.style.height = `${CANVAS_H}px`;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const scrollX = sc.scrollLeft;
    canvas.style.transform = `translateX(${scrollX}px)`;

    const t0 = scrollX / pxPerSec;
    const t1 = (scrollX + viewW) / pxPerSec;
    const xOf = (t: number) => t * pxPerSec - scrollX;
    const { majorSec, minorSec, labelMode } = rulerStep(pxPerSec, fps);

    // backgrounds
    ctx.fillStyle = '#0e1218';
    ctx.fillRect(0, 0, viewW, CANVAS_H);
    ctx.fillStyle = '#0c1016';
    ctx.fillRect(0, LANE_TOP, viewW, LANE_H);

    // ---- clip band (clean editor-style media bar, no thumbnails) ----
    const clipX0 = xOf(0);
    const clipX1 = xOf(dur);
    const grad = ctx.createLinearGradient(0, CLIP_TOP, 0, CLIP_TOP + CLIP_H);
    grad.addColorStop(0, '#2a4660');
    grad.addColorStop(1, '#1a2c3e');
    ctx.fillStyle = grad;
    const cx = Math.max(clipX0, 0);
    const cw = Math.min(clipX1, viewW) - cx;
    if (cw > 0) {
      ctx.fillRect(cx, CLIP_TOP + 4, cw, CLIP_H - 8);
      // subtle gridlines inside the clip band at the ruler's minor interval
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.beginPath();
      for (let t = Math.floor(t0 / minorSec) * minorSec; t <= t1; t += minorSec) {
        const x = xOf(t);
        ctx.moveTo(x + 0.5, CLIP_TOP + 4);
        ctx.lineTo(x + 0.5, CLIP_TOP + CLIP_H - 4);
      }
      ctx.stroke();
      // top highlight line
      ctx.strokeStyle = 'rgba(120,170,210,0.35)';
      ctx.beginPath();
      ctx.moveTo(cx, CLIP_TOP + 4.5);
      ctx.lineTo(cx + cw, CLIP_TOP + 4.5);
      ctx.stroke();
    }

    // band separators
    ctx.strokeStyle = '#070a0e';
    ctx.beginPath();
    ctx.moveTo(0, LANE_TOP + 0.5);
    ctx.lineTo(viewW, LANE_TOP + 0.5);
    ctx.stroke();

    // ---- ruler ----
    ctx.textBaseline = 'top';
    ctx.font = '10px ui-monospace, monospace';
    // minor ticks
    ctx.strokeStyle = '#222a35';
    ctx.beginPath();
    for (let t = Math.floor(t0 / minorSec) * minorSec; t <= t1; t += minorSec) {
      const x = xOf(t);
      ctx.moveTo(x + 0.5, RULER_H - 5);
      ctx.lineTo(x + 0.5, RULER_H);
    }
    ctx.stroke();
    // major ticks
    ctx.strokeStyle = '#3a4250';
    ctx.beginPath();
    for (let t = Math.floor(t0 / majorSec) * majorSec; t <= t1; t += majorSec) {
      const x = xOf(t);
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, RULER_H);
    }
    ctx.stroke();
    // major labels
    ctx.fillStyle = '#9aa3b5';
    for (let t = Math.floor(t0 / majorSec) * majorSec; t <= t1; t += majorSec) {
      if (t < -1e-6) continue;
      ctx.fillText(formatRulerLabel(t, labelMode, fps), xOf(t) + 3, 3);
    }
    // pinned t=0 label
    if (scrollX > 4) {
      ctx.fillStyle = '#0e1218';
      ctx.fillRect(0, 0, 34, RULER_H);
      ctx.fillStyle = '#7b8499';
      ctx.fillText(formatRulerLabel(0, labelMode, fps), 3, 3);
    }

    // ---- rep segments ----
    for (const rep of reps) {
      const x0 = engine.timeOfFrame(rep.startFrame) * pxPerSec - scrollX;
      const endT =
        rep.endFrame + 1 < meta.frameCount
          ? engine.timeOfFrame(rep.endFrame + 1)
          : engine.timeOfFrame(rep.endFrame) + 1 / fps;
      const x1 = endT * pxPerSec - scrollX;
      const w = Math.max(3, x1 - x0);
      if (x0 + w < 0 || x0 > viewW) continue;
      const hue = actionHue(rep.actionType);
      const selected = rep.id === selectedRepId;
      ctx.fillStyle = `hsl(${hue} 62% ${selected ? 54 : 40}%)`;
      ctx.fillRect(x0, LANE_TOP + 7, w, LANE_H - 14);
      ctx.fillStyle = `hsl(${hue} 70% 72%)`;
      ctx.fillRect(x0, LANE_TOP + 7, 2, LANE_H - 14);
      ctx.fillRect(x0 + w - 2, LANE_TOP + 7, 2, LANE_H - 14);
      ctx.strokeStyle = selected ? '#ffffff' : `hsl(${hue} 60% 60%)`;
      ctx.lineWidth = selected ? 2 : 1;
      ctx.strokeRect(x0 + 0.5, LANE_TOP + 7.5, w - 1, LANE_H - 15);
      ctx.lineWidth = 1;
      if (w > 42) {
        ctx.fillStyle = '#06090d';
        ctx.font = '11px -apple-system, sans-serif';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${rep.actionType} #${rep.repIndex}`, x0 + 5, LANE_TOP + LANE_H / 2, w - 10);
        ctx.textBaseline = 'top';
        ctx.font = '10px ui-monospace, monospace';
      }
    }

    // ---- in/out pending band ----
    if (inPoint !== null || outPoint !== null) {
      const a = inPoint ?? outPoint!;
      const b = outPoint ?? inPoint!;
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      const xa = engine.timeOfFrame(lo) * pxPerSec - scrollX;
      const xbT = hi + 1 < meta.frameCount ? engine.timeOfFrame(hi + 1) : engine.timeOfFrame(hi) + 1 / fps;
      const xb = xbT * pxPerSec - scrollX;
      ctx.fillStyle = 'rgba(255, 196, 0, 0.14)';
      ctx.fillRect(xa, 0, Math.max(2, xb - xa), CANVAS_H);
      for (const [pt, color] of [[inPoint, '#ffd23f'], [outPoint, '#ff8c42']] as const) {
        if (pt === null) continue;
        const x = engine.timeOfFrame(pt) * pxPerSec - scrollX;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0);
        ctx.lineTo(x + 0.5, CANVAS_H);
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    }

    // ---- snap guide ----
    if (snapGuideRef.current !== null) {
      const x = snapGuideRef.current * pxPerSec - scrollX;
      ctx.strokeStyle = '#2dd4bf';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, CANVAS_H);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [meta, pxPerSec, fps, dur, reps, inPoint, outPoint, selectedRepId]);

  // keep a ref to the latest draw so scheduleDraw stays identity-stable
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      drawRef.current();
    });
  }, []);

  // ---- playhead position ----
  const positionPlayhead = useCallback(() => {
    const ph = playheadRef.current;
    if (!ph) return;
    ph.style.left = `${frameToContentX(useStore.getState().currentFrame)}px`;
  }, [frameToContentX]);

  // redraw when any draw-relevant state changes
  useEffect(() => {
    scheduleDraw();
  }, [scheduleDraw, meta, pxPerSec, reps, inPoint, outPoint, selectedRepId]);
  useEffect(() => {
    positionPlayhead();
  }, [positionPlayhead, currentFrame, pxPerSec]);

  // ---- fit-to-viewport measurement ----
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || !meta) return;
    const measure = () => {
      const fit = sc.clientWidth / Math.max(0.001, meta.durationSec);
      useStore.getState().setFitZoom(fit);
      scheduleDraw();
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(sc);
    return () => ro.disconnect();
  }, [meta, scheduleDraw]);

  // ---- zoom anchoring: keep a focus point fixed when pxPerSec changes ----
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || !meta) return;
    const prev = prevPxRef.current;
    if (prev !== pxPerSec && prev > 0) {
      const focus = zoomFocusRef.current ?? {
        time: engine.timeOfFrame(useStore.getState().currentFrame),
        screenX: engine.timeOfFrame(useStore.getState().currentFrame) * prev - sc.scrollLeft,
      };
      const maxScroll = Math.max(0, meta.durationSec * pxPerSec - sc.clientWidth);
      sc.scrollLeft = Math.max(0, Math.min(maxScroll, focus.time * pxPerSec - focus.screenX));
    }
    zoomFocusRef.current = null;
    prevPxRef.current = pxPerSec;
    positionPlayhead();
    scheduleDraw();
  }, [pxPerSec, meta, scheduleDraw, positionPlayhead]);

  // ---- auto-follow during playback ----
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc || !meta) return;
    const phX = frameToContentX(currentFrame);
    const margin = 80;
    if (followMode === 'smooth' && isPlaying) {
      const want = phX - sc.clientWidth * 0.45;
      sc.scrollLeft = Math.max(0, Math.min(meta.durationSec * pxPerSec - sc.clientWidth, want));
    } else {
      if (phX < sc.scrollLeft + margin) sc.scrollLeft = Math.max(0, phX - margin);
      else if (phX > sc.scrollLeft + sc.clientWidth - margin) sc.scrollLeft = phX - sc.clientWidth + margin;
    }
    scheduleDraw();
  }, [currentFrame, pxPerSec, meta, isPlaying, followMode, frameToContentX, scheduleDraw]);

  // ---- alt key tracking (temporary snap disable) ----
  useEffect(() => {
    const down = (e: KeyboardEvent) => { if (e.key === 'Alt') altRef.current = true; };
    const up = (e: KeyboardEvent) => { if (e.key === 'Alt') altRef.current = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // ---- wheel: scroll, or cmd/ctrl zoom anchored to cursor ----
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const s = useStore.getState();
        const rect = sc.getBoundingClientRect();
        const cursorTime = (e.clientX - rect.left + sc.scrollLeft) / s.pxPerSec;
        zoomFocusRef.current = { time: cursorTime, screenX: e.clientX - rect.left };
        const factor = Math.exp(-e.deltaY * 0.0015);
        s.setPxPerSec(s.pxPerSec * factor);
      } else {
        const delta = e.deltaX || e.deltaY;
        if (delta === 0) return;
        e.preventDefault();
        sc.scrollLeft += delta;
        scheduleDraw();
      }
    };
    sc.addEventListener('wheel', onWheel, { passive: false });
    return () => sc.removeEventListener('wheel', onWheel);
  }, [scheduleDraw]);

  // ---- pointer interaction ----
  const hitRepEdge = (timeFrame: number, screenX: number, scrollX: number): { rep: Rep; edge: 'start' | 'end' } | null => {
    for (let i = reps.length - 1; i >= 0; i--) {
      const r = reps[i];
      const sx = engine.timeOfFrame(r.startFrame) * pxPerSec - scrollX;
      const eT = r.endFrame + 1 < (meta?.frameCount ?? 0) ? engine.timeOfFrame(r.endFrame + 1) : engine.timeOfFrame(r.endFrame) + 1 / fps;
      const ex = eT * pxPerSec - scrollX;
      if (Math.abs(screenX - sx) <= EDGE_PX) return { rep: r, edge: 'start' };
      if (Math.abs(screenX - ex) <= EDGE_PX) return { rep: r, edge: 'end' };
      if (timeFrame >= r.startFrame && timeFrame <= r.endFrame) return null;
    }
    return null;
  };
  const hitRepBody = (timeFrame: number): Rep | null => {
    for (let i = reps.length - 1; i >= 0; i--) {
      if (timeFrame >= reps[i].startFrame && timeFrame <= reps[i].endFrame) return reps[i];
    }
    return null;
  };

  const snapCandidates = (excludeRepId?: string): number[] => {
    const cands = [0, engine.timeOfFrame(useStore.getState().currentFrame)];
    for (const r of reps) {
      if (r.id === excludeRepId) continue;
      cands.push(engine.timeOfFrame(r.startFrame), engine.timeOfFrame(r.endFrame));
    }
    return cands;
  };

  const applyDrag = (clientX: number) => {
    const drag = dragRef.current;
    const sc = scrollRef.current;
    if (!drag || !sc) return;
    const s = useStore.getState();
    let t = clientXToTime(clientX);
    drag.moved = true;
    const doSnap = s.snapEnabled && !altRef.current && drag.mode !== 'scrub';
    if (doSnap) {
      const res = snapTime(t, snapCandidates(drag.repId), pxPerSec);
      t = res.time;
      snapGuideRef.current = res.snapped ? res.target : null;
    } else {
      snapGuideRef.current = null;
    }
    const frame = engine.frameAtTime(t);
    if (drag.mode === 'scrub') {
      s.setCurrentFrame(frame);
    } else if (drag.mode === 'resizeStart' && drag.repId) {
      s.setBoundary(drag.repId, 'start', frame);
    } else if (drag.mode === 'resizeEnd' && drag.repId) {
      s.setBoundary(drag.repId, 'end', frame);
    } else if (drag.mode === 'moveRep' && drag.repId) {
      const rep = useStore.getState().reps.find((r) => r.id === drag.repId);
      if (rep) {
        const len = rep.endFrame - rep.startFrame;
        let newStart = frame - (drag.grabOffsetFrames ?? 0);
        newStart = Math.max(0, Math.min((meta?.frameCount ?? 1) - 1 - len, newStart));
        s.updateRep(drag.repId, {
          startFrame: newStart,
          endFrame: newStart + len,
          startTimeSec: engine.timeOfFrame(newStart),
          endTimeSec: engine.timeOfFrame(newStart + len),
        });
      }
    }
    scheduleDraw();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!meta) return;
    const sc = scrollRef.current!;
    const rect = sc.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const screenX = e.clientX - rect.left;
    const scrollX = sc.scrollLeft;
    const s = useStore.getState();
    s.setPlaying(false);
    snapGuideRef.current = null;
    const t = clientXToTime(e.clientX);
    const frame = engine.frameAtTime(t);

    let drag: DragState;
    if (y <= RULER_H) {
      drag = { mode: 'scrub', moved: false, pointerId: e.pointerId };
      s.setCurrentFrame(frame);
    } else if (y >= LANE_TOP) {
      const edge = hitRepEdge(frame, screenX, scrollX);
      if (edge) {
        s.selectRep(edge.rep.id);
        drag = { mode: edge.edge === 'start' ? 'resizeStart' : 'resizeEnd', repId: edge.rep.id, moved: false, pointerId: e.pointerId };
      } else {
        const body = hitRepBody(frame);
        if (body) {
          s.selectRep(body.id);
          drag = { mode: 'moveRep', repId: body.id, grabOffsetFrames: frame - body.startFrame, moved: false, pointerId: e.pointerId };
        } else {
          drag = { mode: 'scrub', moved: false, pointerId: e.pointerId };
          s.setCurrentFrame(frame);
        }
      }
    } else {
      drag = { mode: 'scrub', moved: false, pointerId: e.pointerId };
      s.setCurrentFrame(frame);
    }
    dragRef.current = drag;
    sc.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    applyDrag(e.clientX);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    const sc = scrollRef.current;
    if (sc) sc.releasePointerCapture?.(e.pointerId);
    if (drag && drag.mode === 'moveRep' && !drag.moved && drag.repId) {
      const rep = useStore.getState().reps.find((r) => r.id === drag.repId);
      if (rep) useStore.getState().setCurrentFrame(rep.startFrame);
    }
    dragRef.current = null;
    snapGuideRef.current = null;
    scheduleDraw();
  };

  // ---- toolbar: zoom ----
  const zoomBy = (factor: number) => {
    const s = useStore.getState();
    zoomFocusRef.current = null; // anchor to playhead (default in effect)
    s.setPxPerSec(s.pxPerSec * factor);
  };
  const sliderPos = fitZoom > 0 && maxPxPerSec > fitZoom ? Math.log(pxPerSec / fitZoom) / Math.log(maxPxPerSec / fitZoom) : 0;
  const atMinZoom = fitZoom > 0 && pxPerSec <= fitZoom * 1.001;
  const atMaxZoom = pxPerSec >= maxPxPerSec * 0.999;
  const onSlider = (pos: number) => {
    if (fitZoom <= 0) return;
    zoomFocusRef.current = null;
    useStore.getState().setPxPerSec(fitZoom * Math.pow(maxPxPerSec / fitZoom, pos));
  };

  if (!meta) return null;

  return (
    <div className="timeline">
      <div className="timeline-toolbar">
        <span className="tl-label">Zoom</span>
        <button aria-label="Zoom out" title="Zoom out  ( [ )" disabled={atMinZoom} onClick={() => zoomBy(1 / 1.5)}><ZoomOut size={15} /></button>
        <input
          className="zoom-slider"
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={Math.max(0, Math.min(1, sliderPos))}
          onChange={(e) => onSlider(Number(e.target.value))}
          title="Drag to zoom the timeline in/out"
        />
        <button aria-label="Zoom in" title="Zoom in  ( ] )" disabled={atMaxZoom} onClick={() => zoomBy(1.5)}><ZoomIn size={15} /></button>
        <button title="Zoom out so the whole video fits in view  (Shift+Z)" onClick={() => useStore.getState().zoomToFit()}>Fit all</button>
        <span className="tl-divider" />
        <button
          className={snapEnabled ? 'active' : ''}
          title="Snap a rep's edges to the playhead / other reps while you drag them. Hold Alt to bypass.  (S)"
          onClick={() => useStore.getState().toggleSnap()}
        >
          Snap edges: {snapEnabled ? 'on' : 'off'}
        </button>
        <button
          className={followMode === 'smooth' ? 'active' : ''}
          title="How the timeline scrolls to keep up with the playhead during playback: Page = jump a page at a time; Center = keep the playhead centered."
          onClick={() => useStore.getState().setFollowMode(followMode === 'page' ? 'smooth' : 'page')}
        >
          Auto-scroll: {followMode === 'smooth' ? 'center' : 'page'}
        </button>
        <span className="tl-spacer" />
        <span className="tl-readout">{reps.length} reps · {meta.frameCount} frames</span>
      </div>

      <div
        className="timeline-scroll"
        ref={scrollRef}
        onScroll={scheduleDraw}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="timeline-spacer" style={{ width: contentWidth, height: CANVAS_H }} />
        <canvas ref={canvasRef} className="timeline-canvas" />
        <div className="timeline-playhead" ref={playheadRef} style={{ height: CANVAS_H }}>
          <div className="ph-handle" />
          <div className="ph-line" />
        </div>
      </div>
    </div>
  );
}
