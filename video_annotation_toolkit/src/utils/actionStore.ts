import type { ActionTypeDef } from '../types';
import { ACTION_TYPES } from '../config/actions.config';

/**
 * Per-video action labels live in a hand-edited file: `action_labels/<videobasename>.json`.
 * The app fetches it on load (matched to the video name) and uses it to populate the action
 * dropdown — so you maintain the label taxonomy in the JSON file, not in the GUI.
 *
 * Accepted shapes:
 *   { "actions": [ { "id": "squat", "label": "Squat", "hotkey": "1" }, ... ] }
 *   or a bare array of the same objects.
 * `id` is what's written to the CSV (keep it stable). `hotkey` is an optional "1"–"9".
 */
export async function loadActionLabels(videoBase: string): Promise<ActionTypeDef[] | null> {
  try {
    const res = await fetch(`/action_labels/${encodeURIComponent(videoBase)}.json`);
    if (!res.ok) return null;
    const raw = await res.json();
    const arr = Array.isArray(raw) ? raw : raw?.actions;
    if (!Array.isArray(arr)) return null;

    const seenId = new Set<string>();
    const claimedKey = new Set<string>();
    const out: ActionTypeDef[] = [];
    for (const a of arr) {
      if (!a || typeof a.id !== 'string') continue;
      const id = a.id.trim();
      if (!id || seenId.has(id)) continue;
      seenId.add(id);
      let hotkey: string | undefined =
        typeof a.hotkey === 'string' ? a.hotkey.trim().slice(0, 1) : undefined;
      if (hotkey && (!/^[1-9]$/.test(hotkey) || claimedKey.has(hotkey))) hotkey = undefined;
      else if (hotkey) claimedKey.add(hotkey);
      out.push({ id, label: String(a.label ?? id), hotkey });
    }
    return out.length ? out : null;
  } catch {
    return null;
  }
}

/** Effective action list: the per-video file, or the built-in defaults when none exists. */
export function getEffectiveActions(loaded: ActionTypeDef[] | null): ActionTypeDef[] {
  return loaded && loaded.length ? loaded : ACTION_TYPES;
}
