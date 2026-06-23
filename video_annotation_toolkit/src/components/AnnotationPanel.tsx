import { useMemo, useState } from 'react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { getEffectiveActions, validateNewAction } from '../utils/actionStore';
import { formatTimecode } from '../utils/time';

export default function AnnotationPanel() {
  const meta = useStore((s) => s.meta);
  const currentAction = useStore((s) => s.currentAction);
  const setCurrentAction = useStore((s) => s.setCurrentAction);
  const customActions = useStore((s) => s.customActions);
  const addCustomAction = useStore((s) => s.addCustomAction);
  const inPoint = useStore((s) => s.inPoint);
  const outPoint = useStore((s) => s.outPoint);
  const pendingNotes = useStore((s) => s.pendingNotes);
  const setPendingNotes = useStore((s) => s.setPendingNotes);
  const markIn = useStore((s) => s.markIn);
  const markOut = useStore((s) => s.markOut);
  const clearInOut = useStore((s) => s.clearInOut);
  const commitRep = useStore((s) => s.commitRep);

  const [adding, setAdding] = useState(false);
  const [newId, setNewId] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newHotkey, setNewHotkey] = useState('');
  const [addError, setAddError] = useState('');

  const actions = useMemo(() => getEffectiveActions(customActions), [customActions]);

  if (!meta) return null;

  const fmt = (f: number | null) =>
    f === null ? '—' : `${f} · ${formatTimecode(engine.timeOfFrame(f), meta.fps)}`;

  const canCommit = inPoint !== null && outPoint !== null && currentAction.length > 0;
  const repFrames = inPoint !== null && outPoint !== null ? Math.abs(outPoint - inPoint) + 1 : 0;

  const submitCustom = () => {
    const res = validateNewAction(newId, newLabel, newHotkey, customActions);
    if (!res.ok || !res.normalized) {
      setAddError(res.error ?? 'Invalid');
      return;
    }
    addCustomAction(res.normalized); // appended to dropdown + persisted per-video + selected
    setAdding(false);
    setNewId('');
    setNewLabel('');
    setNewHotkey('');
    setAddError('');
  };

  return (
    <div className="panel annotation-panel">
      <h2>Annotate</h2>

      <label className="field-label">Action type</label>
      <div className="action-row">
        <select
          value={actions.some((a) => a.id === currentAction) ? currentAction : ''}
          onChange={(e) => { if (e.target.value) setCurrentAction(e.target.value); }}
        >
          {!actions.some((a) => a.id === currentAction) && <option value="">— select —</option>}
          {actions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {a.hotkey ? `  (${a.hotkey})` : ''}
              {a.custom ? '  •' : ''}
            </option>
          ))}
        </select>
        <button
          className="add-action"
          aria-label={adding ? 'Cancel custom action' : 'Add a custom action type'}
          title="Add a custom action type"
          onClick={() => setAdding((v) => !v)}
        >
          {adding ? '×' : '＋'}
        </button>
      </div>

      {adding && (
        <div className="custom-form">
          <input placeholder="id (e.g. squat_deep)" value={newId} onChange={(e) => setNewId(e.target.value)} autoFocus />
          <input placeholder="label (e.g. Deep Squat)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
          <input className="hotkey-input" placeholder="key 1-9" maxLength={1} value={newHotkey} onChange={(e) => setNewHotkey(e.target.value)} />
          <button className="primary" onClick={submitCustom}>Add</button>
          {addError && <span className="add-error">{addError}</span>}
          <span className="custom-hint">Saved for this video; reappears next time you load it.</span>
        </div>
      )}

      <div className="inout-grid">
        <div>
          <span className="field-label">In</span>
          <div className="inout-val in">{fmt(inPoint)}</div>
        </div>
        <div>
          <span className="field-label">Out</span>
          <div className="inout-val out">{fmt(outPoint)}</div>
        </div>
      </div>

      <div className="mark-buttons">
        <button onClick={markIn} title="Mark In (I)">Mark In</button>
        <button onClick={markOut} title="Mark Out (O)">Mark Out</button>
        <button onClick={clearInOut} title="Clear (Esc)" className="ghost">Clear</button>
      </div>

      <textarea
        className="notes-input"
        rows={2}
        placeholder="rep note (optional) — drag corner to expand"
        value={pendingNotes}
        onChange={(e) => setPendingNotes(e.target.value)}
      />

      <button className="commit" disabled={!canCommit} onClick={() => commitRep()} title="Add rep (Enter)">
        ＋ Add Rep {repFrames > 0 ? `· ${repFrames} frames` : ''}
      </button>

      <p className="hint">
        <kbd>I</kbd>/<kbd>O</kbd> mark · <kbd>Enter</kbd> add · <kbd>←</kbd>/<kbd>→</kbd> step · <kbd>?</kbd> all keys
      </p>
    </div>
  );
}
