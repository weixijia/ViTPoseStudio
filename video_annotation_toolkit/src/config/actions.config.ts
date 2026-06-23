/**
 * ★ ACTION TAXONOMY — EDIT THIS LIST FOR YOUR PROJECT ★
 *
 * Each entry is one exercise / action type an annotator can assign to a rep.
 *  - id:     stable machine-readable key written to the CSV (`action_type`). Keep it
 *            short, lowercase, no spaces — this becomes an ML label, so consistency matters.
 *  - label:  human-readable name shown in the UI dropdown.
 *  - hotkey: optional single key ("1"-"9") to select this action instantly.
 *
 * Annotators can still type an ad-hoc action not in this list (see AnnotationPanel),
 * but predefining them here keeps labels consistent across your dataset.
 *
 * The list below is placeholder content — replace it with your real movement set.
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
