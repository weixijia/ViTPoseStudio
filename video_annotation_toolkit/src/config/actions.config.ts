/**
 * DEFAULT action taxonomy — used only when a video has NO `action_labels/<name>.json`.
 *
 * Per-video labels are normally maintained in `action_labels/<videobasename>.json`
 * (hand-edited, loaded automatically by file-name match). This list is the fallback
 * when that file is missing.
 *
 *  - id:     stable machine-readable key written to the CSV (`action_type`). Keep it
 *            short, lowercase, no spaces — this becomes an ML label.
 *  - label:  human-readable name shown in the UI dropdown.
 *  - hotkey: optional single key ("1"-"9") to select this action instantly.
 */
import type { ActionTypeDef } from '../types';

export type { ActionTypeDef };

export const ACTION_TYPES: ActionTypeDef[] = [
  { id: 'squat', label: 'Squat', hotkey: '1' },
  { id: 'pushup', label: 'Push-up', hotkey: '2' },
  { id: 'lunge', label: 'Lunge', hotkey: '3' },
  { id: 'situp', label: 'Sit-up', hotkey: '4' },
  { id: 'jumping_jack', label: 'Jumping Jack', hotkey: '5' },
  { id: 'burpee', label: 'Burpee', hotkey: '6' },
  { id: 'plank', label: 'Plank (hold)', hotkey: '7' },
  { id: 'bicep_curl', label: 'Bicep Curl', hotkey: '8' },
];
