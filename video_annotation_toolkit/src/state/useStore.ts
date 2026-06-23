import { create } from 'zustand';
import type { Rep, VideoMeta, ProjectState, ActionTypeDef } from '../types';
import { ACTION_TYPES } from '../config/actions.config';
import { saveCustomActions } from '../utils/actionStore';

let repCounter = 0;
function newId(): string {
  repCounter += 1;
  return `rep_${repCounter}_${performance.now().toFixed(0)}`;
}

export type FollowMode = 'page' | 'smooth';

interface AppState {
  // ---- video / playback ----
  meta: VideoMeta | null;
  currentFrame: number;
  isPlaying: boolean;
  speed: number;

  // ---- timeline ----
  pxPerSec: number;
  fitZoom: number;
  maxPxPerSec: number;
  followMode: FollowMode;
  snapEnabled: boolean;

  // ---- annotation working state ----
  reps: Rep[];
  currentAction: string;
  inPoint: number | null;
  outPoint: number | null;
  pendingNotes: string;
  selectedRepId: string | null;
  annotator: string;
  customActions: ActionTypeDef[];

  // ---- ui ----
  showShortcuts: boolean;

  // ---- video / playback actions ----
  setMeta: (meta: VideoMeta | null) => void;
  setCurrentFrame: (frame: number) => void;
  stepFrame: (delta: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;

  // ---- timeline actions ----
  setPxPerSec: (px: number) => void;
  setFitZoom: (fit: number) => void;
  zoomToFit: () => void;
  toggleSnap: () => void;
  setFollowMode: (mode: FollowMode) => void;

  // ---- annotation actions ----
  setCurrentAction: (action: string) => void;
  setAnnotator: (name: string) => void;
  setPendingNotes: (notes: string) => void;
  markIn: () => void;
  markOut: () => void;
  clearInOut: () => void;
  commitRep: () => string | null;
  selectRep: (id: string | null) => void;
  selectAdjacentRep: (dir: 1 | -1) => void;
  updateRep: (id: string, patch: Partial<Rep>) => void;
  setBoundary: (id: string, edge: 'start' | 'end', frame: number) => void;
  nudgeBoundary: (edge: 'start' | 'end', delta: number) => void;
  snapBoundaryToPlayhead: (edge: 'start' | 'end') => void;
  deleteRep: (id: string) => void;

  // ---- custom actions ----
  setCustomActions: (list: ActionTypeDef[]) => void;
  addCustomAction: (def: ActionTypeDef) => void;

  // ---- ui actions ----
  toggleShortcuts: () => void;

  // ---- project ----
  loadProject: (project: ProjectState, meta: VideoMeta) => void;
  resetForNewVideo: (meta: VideoMeta) => void;
}

function clampFrame(frame: number, meta: VideoMeta | null): number {
  if (!meta) return 0;
  return Math.min(meta.frameCount - 1, Math.max(0, Math.round(frame)));
}

/**
 * Renumber reps: per action_type, sequential by start-frame order, no gaps.
 * Run after every mutation that changes the rep set, so deleting a middle rep
 * re-closes the numbering (squat 1,2,3 → delete #2 → 1,2).
 */
function renumberReps(reps: Rep[]): Rep[] {
  const sorted = [...reps].sort((a, b) => a.startFrame - b.startFrame || a.endFrame - b.endFrame);
  const counters: Record<string, number> = {};
  return sorted.map((r) => {
    const n = (counters[r.actionType] = (counters[r.actionType] ?? 0) + 1);
    return r.repIndex === n ? r : { ...r, repIndex: n };
  });
}

export const useStore = create<AppState>((set, get) => ({
  meta: null,
  currentFrame: 0,
  isPlaying: false,
  speed: 1,

  pxPerSec: 0,
  fitZoom: 0,
  maxPxPerSec: 600,
  followMode: 'page',
  snapEnabled: true,

  reps: [],
  currentAction: ACTION_TYPES[0]?.id ?? '',
  inPoint: null,
  outPoint: null,
  pendingNotes: '',
  selectedRepId: null,
  annotator: '',
  customActions: [],

  showShortcuts: false,

  setMeta: (meta) => set({ meta }),
  setCurrentFrame: (frame) => set({ currentFrame: clampFrame(frame, get().meta) }),
  stepFrame: (delta) => set({ currentFrame: clampFrame(get().currentFrame + delta, get().meta) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  setSpeed: (speed) => set({ speed }),

  setPxPerSec: (px) => {
    const { fitZoom, maxPxPerSec } = get();
    const lo = fitZoom > 0 ? fitZoom : 0.01;
    const hi = maxPxPerSec > 0 ? maxPxPerSec : 1000;
    set({ pxPerSec: Math.min(hi, Math.max(lo, px)) });
  },
  setFitZoom: (fit) => {
    const { pxPerSec } = get();
    // initialize zoom to "fit" on first measure, and never allow zooming out past fit
    const next = pxPerSec <= 0 || pxPerSec < fit ? fit : pxPerSec;
    set({ fitZoom: fit, pxPerSec: next });
  },
  zoomToFit: () => set({ pxPerSec: get().fitZoom }),
  toggleSnap: () => set({ snapEnabled: !get().snapEnabled }),
  setFollowMode: (followMode) => set({ followMode }),

  setCurrentAction: (currentAction) => set({ currentAction }),
  setAnnotator: (annotator) => set({ annotator }),
  setPendingNotes: (pendingNotes) => set({ pendingNotes }),

  markIn: () => {
    const { currentFrame, outPoint } = get();
    set({ inPoint: currentFrame, outPoint: outPoint !== null && outPoint < currentFrame ? null : outPoint });
  },
  markOut: () => {
    const { currentFrame, inPoint } = get();
    set({ outPoint: currentFrame, inPoint: inPoint !== null && inPoint > currentFrame ? null : inPoint });
  },
  clearInOut: () => set({ inPoint: null, outPoint: null, pendingNotes: '' }),

  commitRep: () => {
    const state = get();
    const { inPoint, outPoint, currentAction, meta, pendingNotes } = state;
    if (inPoint === null || outPoint === null || !meta || !currentAction) return null;
    const start = Math.min(inPoint, outPoint);
    const end = Math.max(inPoint, outPoint);
    const rep: Rep = {
      id: newId(),
      actionType: currentAction,
      repIndex: 0, // assigned by renumberReps
      startFrame: start,
      endFrame: end,
      startTimeSec: engineTime(start),
      endTimeSec: engineTime(end),
      notes: pendingNotes.trim(),
    };
    const reps = renumberReps([...state.reps, rep]);
    set({ reps, inPoint: null, outPoint: null, pendingNotes: '', selectedRepId: rep.id });
    return rep.id;
  },

  selectRep: (selectedRepId) => set({ selectedRepId }),
  selectAdjacentRep: (dir) => {
    const { reps, selectedRepId } = get();
    if (reps.length === 0) return;
    const sorted = [...reps].sort((a, b) => a.startFrame - b.startFrame);
    const idx = sorted.findIndex((r) => r.id === selectedRepId);
    const nextIdx = idx === -1 ? (dir === 1 ? 0 : sorted.length - 1) : Math.min(sorted.length - 1, Math.max(0, idx + dir));
    const target = sorted[nextIdx];
    if (target) set({ selectedRepId: target.id, currentFrame: target.startFrame, isPlaying: false });
  },
  updateRep: (id, patch) =>
    set({ reps: renumberReps(get().reps.map((r) => (r.id === id ? { ...r, ...patch } : r))) }),

  setBoundary: (id, edge, frame) => {
    const { reps, meta } = get();
    const rep = reps.find((r) => r.id === id);
    if (!rep || !meta) return;
    const f = clampFrame(frame, meta);
    if (edge === 'start') {
      const start = Math.min(f, rep.endFrame);
      get().updateRep(id, { startFrame: start, startTimeSec: engineTime(start) });
    } else {
      const end = Math.max(f, rep.startFrame);
      get().updateRep(id, { endFrame: end, endTimeSec: engineTime(end) });
    }
  },
  nudgeBoundary: (edge, delta) => {
    const { selectedRepId, reps } = get();
    if (!selectedRepId) return;
    const rep = reps.find((r) => r.id === selectedRepId);
    if (!rep) return;
    get().setBoundary(selectedRepId, edge, (edge === 'start' ? rep.startFrame : rep.endFrame) + delta);
  },
  snapBoundaryToPlayhead: (edge) => {
    const { selectedRepId, currentFrame } = get();
    if (!selectedRepId) return;
    get().setBoundary(selectedRepId, edge, currentFrame);
  },
  deleteRep: (id) =>
    set({
      reps: renumberReps(get().reps.filter((r) => r.id !== id)),
      selectedRepId: get().selectedRepId === id ? null : get().selectedRepId,
    }),

  setCustomActions: (customActions) => set({ customActions }),
  addCustomAction: (def) => {
    const next = [...get().customActions, def];
    set({ customActions: next, currentAction: def.id });
    const name = get().meta?.name;
    if (name) saveCustomActions(name, next);
  },

  toggleShortcuts: () => set({ showShortcuts: !get().showShortcuts }),

  loadProject: (project, meta) =>
    set({
      meta,
      reps: renumberReps(project.reps ?? []),
      annotator: project.annotator ?? '',
      currentFrame: 0,
      inPoint: null,
      outPoint: null,
      pendingNotes: '',
      selectedRepId: null,
      isPlaying: false,
    }),

  resetForNewVideo: (meta) =>
    set({
      meta,
      reps: [],
      currentFrame: 0,
      inPoint: null,
      outPoint: null,
      pendingNotes: '',
      selectedRepId: null,
      isPlaying: false,
      speed: 1,
      pxPerSec: 0,
      fitZoom: 0,
      maxPxPerSec: Math.max(Math.round(meta.fps * 30), 600),
    }),
}));

/**
 * The store needs exact per-frame timestamps when committing/editing reps, but
 * the engine lives outside React. This thin bridge avoids a circular import;
 * App registers the engine's time lookup on load.
 */
let engineTimeLookup: ((frame: number) => number) | null = null;
export function registerEngineTimeLookup(fn: ((frame: number) => number) | null) {
  engineTimeLookup = fn;
}
function engineTime(frame: number): number {
  if (engineTimeLookup) return engineTimeLookup(frame);
  const meta = useStore.getState().meta;
  return meta && meta.fps > 0 ? frame / meta.fps : 0;
}
