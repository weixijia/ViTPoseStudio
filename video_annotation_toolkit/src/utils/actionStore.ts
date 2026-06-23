import type { ActionTypeDef, ActionsFile } from '../types';
import { ACTION_TYPES } from '../config/actions.config';
import { downloadText, baseName } from './csv';

const LS_PREFIX = 'repannotator.actions.v1::';

/** localStorage key for a given video filename. */
function lsKey(videoName: string): string {
  return LS_PREFIX + videoName;
}

/** Built-in action ids (cannot be shadowed by custom ones). */
const BUILTIN_IDS = new Set(ACTION_TYPES.map((a) => a.id));
const BUILTIN_HOTKEYS = new Set(ACTION_TYPES.map((a) => a.hotkey).filter(Boolean) as string[]);

/** Load custom actions saved for this video (auto-restore on reload of same file). */
export function loadCustomActions(videoName: string): ActionTypeDef[] {
  try {
    const raw = localStorage.getItem(lsKey(videoName));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ActionTypeDef[];
    return Array.isArray(parsed) ? parsed.filter((a) => a && a.id) : [];
  } catch {
    return [];
  }
}

/** Persist this video's custom actions. */
export function saveCustomActions(videoName: string, actions: ActionTypeDef[]) {
  try {
    localStorage.setItem(lsKey(videoName), JSON.stringify(actions));
  } catch {
    /* localStorage may be unavailable / full — non-fatal */
  }
}

/**
 * Effective dropdown list: built-ins first (config order), then custom actions
 * sorted by label, de-duped by id (built-in wins).
 */
export function getEffectiveActions(custom: ActionTypeDef[]): ActionTypeDef[] {
  const extra = custom
    .filter((a) => !BUILTIN_IDS.has(a.id))
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));
  return [...ACTION_TYPES, ...extra];
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  normalized?: ActionTypeDef;
}

/** Validate & normalize a new custom action id. */
export function validateNewAction(
  rawId: string,
  rawLabel: string,
  rawHotkey: string,
  custom: ActionTypeDef[],
): ValidationResult {
  const id = rawId.trim().toLowerCase().replace(/\s+/g, '_');
  if (!id) return { ok: false, error: 'Enter an id.' };
  if (!/^[a-z0-9_]+$/.test(id)) return { ok: false, error: 'Use lowercase letters, digits, _ only.' };
  if (BUILTIN_IDS.has(id)) return { ok: false, error: `"${id}" is a built-in action.` };
  if (custom.some((a) => a.id === id)) return { ok: false, error: `"${id}" already exists.` };
  // a custom hotkey that collides with a built-in or existing custom is dropped
  let hotkey: string | undefined = rawHotkey.trim().slice(0, 1);
  if (hotkey && (!/^[1-9]$/.test(hotkey) || BUILTIN_HOTKEYS.has(hotkey) || custom.some((a) => a.hotkey === hotkey))) {
    hotkey = undefined;
  }
  const label = rawLabel.trim() || id;
  return { ok: true, normalized: { id, label, hotkey, custom: true } };
}

/** Download `<videobasename>_actions.json`. */
export function exportActionsFile(videoName: string, actions: ActionTypeDef[]) {
  const file: ActionsFile = {
    version: 1,
    videoFilename: videoName,
    actions,
    savedAt: new Date().toISOString(),
  };
  downloadText(`${baseName(videoName)}_actions.json`, JSON.stringify(file, null, 2), 'application/json');
}

/** Parse an imported actions file, returning its custom actions. */
export async function importActionsFile(file: File): Promise<ActionsFile> {
  const text = await file.text();
  const parsed = JSON.parse(text) as ActionsFile;
  if (!Array.isArray(parsed.actions)) throw new Error('Invalid actions file: missing "actions" array.');
  return parsed;
}

/** Merge imported actions into existing custom list (de-dup by id, skip built-ins,
 *  drop hotkeys that collide with a built-in or an already-claimed key). */
export function mergeActions(existing: ActionTypeDef[], incoming: ActionTypeDef[]): ActionTypeDef[] {
  const byId = new Map(existing.map((a) => [a.id, a]));
  for (const a of incoming) {
    if (!a || !a.id || BUILTIN_IDS.has(a.id)) continue;
    byId.set(a.id, { ...a, custom: true });
  }
  // resolve hotkey collisions: first claim wins, later duplicates lose their key
  const claimed = new Set<string>(BUILTIN_HOTKEYS);
  return [...byId.values()].map((a) => {
    if (!a.hotkey) return a;
    if (claimed.has(a.hotkey)) return { ...a, hotkey: undefined };
    claimed.add(a.hotkey);
    return a;
  });
}
