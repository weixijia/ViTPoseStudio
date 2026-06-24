/** A single repetition (one cycle of a movement) — the atomic annotation unit. */
export interface Rep {
  id: string;
  actionType: string;
  repIndex: number; // 1-based, per action_type, renumbered by start-frame order
  startFrame: number;
  endFrame: number;
  startTimeSec: number;
  endTimeSec: number;
  notes: string;
}

/** Metadata extracted from a loaded video. */
export interface VideoMeta {
  name: string;
  width: number;
  height: number;
  durationSec: number;
  fps: number;
  frameCount: number;
}

/** A user-defined or built-in action type. */
export interface ActionTypeDef {
  id: string;
  label: string;
  hotkey?: string;
  custom?: boolean;
}

/** Full annotation project — serialized to JSON for save / resume. */
export interface ProjectState {
  version: 1 | 2;
  videoName: string;
  fps: number;
  frameCount: number;
  durationSec: number;
  annotator: string;
  reps: Rep[];
  poseErrors?: Record<number, PoseError>;
  savedAt: string;
}

/** Per-frame pose-quality flag: predefined labels + free note. */
export interface PoseError {
  labels: string[];
  note: string;
}

/** Per-video action labels file: `action_labels/<videobasename>.json` (hand-edited). */
export interface ActionLabelsFile {
  actions: ActionTypeDef[];
}
