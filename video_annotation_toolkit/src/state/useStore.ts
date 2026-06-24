import { create } from 'zustand';
import type { Rep, VideoMeta, ProjectState, ActionTypeDef, PoseError } from '../types';
import { ACTION_TYPES } from '../config/actions.config';

let repCounter = 0;
function newId(): string {
  repCounter += 1;
  return `rep_${repCounter}_${performance.now().toFixed(0)}`;
}

export type FollowMode = 'page' | 'smooth';

/** Default timeline zoom (px per second) on load — fine enough for a seconds-level ruler. */
const DEFAULT_PX_PER_SEC = 18;

interface AppState {
  // ---- video / playback ----
  meta: VideoMeta | null;
  currentFrame: number;
  isPlaying: boolean;
  speed: number;
  muted: boolean;

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
  actionTypes: ActionTypeDef[]; // effective label list for the current video (from action_labels/<name>.json or defaults)

  // ---- pose-quality review (MediaPipe skeleton) ----
  poseErrors: Record<number, PoseError>; // committed (drives CSV, timeline, flagged list)
  // draft for the frame currently being edited (committed only on Save / when leaving the frame)
  poseDraftFrame: number | null;
  poseDraftLabels: string[];
  poseDraftNote: string;
  poseDirty: boolean;
  skeletonBackdrop: boolean;
  hasSkeleton: boolean;

  // ---- ui ----
  showShortcuts: boolean;

  // ---- video / playback actions ----
  setMeta: (meta: VideoMeta | null) => void;
  setCurrentFrame: (frame: number) => void;
  stepFrame: (delta: number) => void;
  setPlaying: (playing: boolean) => void;
  togglePlay: () => void;
  setSpeed: (speed: number) => void;
  toggleMuted: () => void;

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
  setActionTypes: (list: ActionTypeDef[]) => void;

  // ---- pose-quality actions (draft → Save) ----
  beginPoseDraft: (frame: number) => void;
  toggleDraftLabel: (labelId: string) => void;
  setDraftNote: (note: string) => void;
  savePoseDraft: () => void;
  revertPoseDraft: () => void;
  clearPoseFrame: (frame: number) => void;
  toggleSkeletonBackdrop: () => void;
  setHasSkeleton: (has: boolean) => void;

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

/** Commit a draft into the committed pose-errors map (delete when empty). */
function commitDraft(
  map: Record<number, PoseError>,
  frame: number,
  labels: string[],
  note: string,
): Record<number, PoseError> {
  const next = { ...map };
  if (labels.length === 0 && !note.trim()) delete next[frame];
  else next[frame] = { labels: [...labels], note };
  return next;
}

export const useStore = create<AppState>((set, get) => ({
  meta: null,
  currentFrame: 0,
  isPlaying: false,
  speed: 1,
  muted: false,

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
  actionTypes: ACTION_TYPES,

  poseErrors: {},
  poseDraftFrame: null,
  poseDraftLabels: [],
  poseDraftNote: '',
  poseDirty: false,
  skeletonBackdrop: true,
  hasSkeleton: false,

  showShortcuts: false,

  setMeta: (meta) => set({ meta }),
  setCurrentFrame: (frame) => set({ currentFrame: clampFrame(frame, get().meta) }),
  stepFrame: (delta) => set({ currentFrame: clampFrame(get().currentFrame + delta, get().meta) }),
  setPlaying: (playing) => set({ isPlaying: playing }),
  togglePlay: () => set({ isPlaying: !get().isPlaying }),
  setSpeed: (speed) => set({ speed }),
  toggleMuted: () => set({ muted: !get().muted }),

  setPxPerSec: (px) => {
    const { fitZoom, maxPxPerSec } = get();
    const lo = fitZoom > 0 ? fitZoom : 0.01;
    const hi = maxPxPerSec > 0 ? maxPxPerSec : 1000;
    set({ pxPerSec: Math.min(hi, Math.max(lo, px)) });
  },
  setFitZoom: (fit) => {
    const { pxPerSec, maxPxPerSec } = get();
    let next = pxPerSec;
    if (pxPerSec <= 0) {
      // first measure: default to a fine, seconds-level zoom (not the whole clip,
      // which for a long video forces a coarse minutes-scale ruler). Never below fit.
      next = Math.min(maxPxPerSec, Math.max(DEFAULT_PX_PER_SEC, fit));
    } else if (pxPerSec < fit) {
      next = fit; // enforce zoom-out floor
    }
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

  setActionTypes: (actionTypes) => {
    // keep the current selection valid against the new label set
    const cur = get().currentAction;
    const ok = actionTypes.some((a) => a.id === cur);
    set({ actionTypes, currentAction: ok ? cur : actionTypes[0]?.id ?? '' });
  },

  beginPoseDraft: (frame) => {
    const s = get();
    if (s.poseDraftFrame === frame) return; // already editing this frame — keep the draft
    let poseErrors = s.poseErrors;
    // auto-flush a dirty draft from the frame we're leaving (no silent data loss)
    if (s.poseDirty && s.poseDraftFrame !== null) {
      poseErrors = commitDraft(poseErrors, s.poseDraftFrame, s.poseDraftLabels, s.poseDraftNote);
    }
    const committed = poseErrors[frame];
    set({
      poseErrors,
      poseDraftFrame: frame,
      poseDraftLabels: committed ? [...committed.labels] : [],
      poseDraftNote: committed ? committed.note : '',
      poseDirty: false,
    });
  },
  toggleDraftLabel: (labelId) => {
    const frame = get().currentFrame;
    if (get().poseDraftFrame !== frame) get().beginPoseDraft(frame);
    const have = get().poseDraftLabels;
    const labels = have.includes(labelId) ? have.filter((l) => l !== labelId) : [...have, labelId];
    set({ poseDraftLabels: labels, poseDirty: true });
  },
  setDraftNote: (note) => {
    const frame = get().currentFrame;
    if (get().poseDraftFrame !== frame) get().beginPoseDraft(frame);
    set({ poseDraftNote: note, poseDirty: true });
  },
  savePoseDraft: () => {
    const s = get();
    if (s.poseDraftFrame === null) return;
    set({
      poseErrors: commitDraft(s.poseErrors, s.poseDraftFrame, s.poseDraftLabels, s.poseDraftNote),
      poseDirty: false,
    });
  },
  revertPoseDraft: () => {
    const s = get();
    if (s.poseDraftFrame === null) return;
    const committed = s.poseErrors[s.poseDraftFrame];
    set({
      poseDraftLabels: committed ? [...committed.labels] : [],
      poseDraftNote: committed ? committed.note : '',
      poseDirty: false,
    });
  },
  clearPoseFrame: (frame) => {
    const s = get();
    const poseErrors = { ...s.poseErrors };
    delete poseErrors[frame];
    if (s.poseDraftFrame === frame) set({ poseErrors, poseDraftLabels: [], poseDraftNote: '', poseDirty: false });
    else set({ poseErrors });
  },
  toggleSkeletonBackdrop: () => set({ skeletonBackdrop: !get().skeletonBackdrop }),
  setHasSkeleton: (hasSkeleton) => set({ hasSkeleton }),

  toggleShortcuts: () => set({ showShortcuts: !get().showShortcuts }),

  loadProject: (project, meta) =>
    set({
      meta,
      reps: renumberReps(project.reps ?? []),
      poseErrors: project.poseErrors ?? {},
      poseDraftFrame: null,
      poseDraftLabels: [],
      poseDraftNote: '',
      poseDirty: false,
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
      poseErrors: {},
      poseDraftFrame: null,
      poseDraftLabels: [],
      poseDraftNote: '',
      poseDirty: false,
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
