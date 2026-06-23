/**
 * ★ POSE-ERROR LABELS — EDIT FOR YOUR PROJECT ★
 *
 * When reviewing the MediaPipe skeleton frame-by-frame, an annotator can flag a
 * frame whose pose looks wrong and tag it with one or more of these labels (plus
 * an optional free-text note). `id` is written to the pose-errors CSV.
 */
export interface PoseErrorLabelDef {
  id: string;
  label: string;
  hotkey?: string; // optional single key to toggle this label on the current frame
}

export const POSE_ERROR_LABELS: PoseErrorLabelDef[] = [
  { id: 'tracking_error', label: 'Tracking', hotkey: 'q' },
  { id: 'occlusion', label: 'Occlusion', hotkey: 'w' },
  { id: 'drift', label: 'Drift', hotkey: 'e' },
  { id: 'non_human', label: 'Garbage', hotkey: 'r' },
  { id: 'out_of_frame', label: 'Off-frame', hotkey: 't' },
  { id: 'wrong_person', label: 'Wrong person', hotkey: 'y' },
];
