import { Plus } from 'lucide-react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { formatTimecode } from '../utils/time';

export default function AnnotationPanel() {
  const meta = useStore((s) => s.meta);
  const currentAction = useStore((s) => s.currentAction);
  const setCurrentAction = useStore((s) => s.setCurrentAction);
  const actions = useStore((s) => s.actionTypes);
  const inPoint = useStore((s) => s.inPoint);
  const outPoint = useStore((s) => s.outPoint);
  const pendingNotes = useStore((s) => s.pendingNotes);
  const setPendingNotes = useStore((s) => s.setPendingNotes);
  const markIn = useStore((s) => s.markIn);
  const markOut = useStore((s) => s.markOut);
  const clearInOut = useStore((s) => s.clearInOut);
  const commitRep = useStore((s) => s.commitRep);

  if (!meta) return null;

  const fmt = (f: number | null) =>
    f === null ? '—' : `${f} · ${formatTimecode(engine.timeOfFrame(f), meta.fps)}`;

  const canCommit = inPoint !== null && outPoint !== null && currentAction.length > 0;
  const repFrames = inPoint !== null && outPoint !== null ? Math.abs(outPoint - inPoint) + 1 : 0;

  return (
    <div className="panel annotation-panel">
      <h2>Annotate</h2>

      <label className="field-label" htmlFor="action-select">Action type</label>
      <div className="action-row">
        <select
          id="action-select"
          value={actions.some((a) => a.id === currentAction) ? currentAction : ''}
          onChange={(e) => { if (e.target.value) setCurrentAction(e.target.value); }}
        >
          {!actions.some((a) => a.id === currentAction) && <option value="">— select —</option>}
          {actions.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
              {a.hotkey ? `  (${a.hotkey})` : ''}
            </option>
          ))}
        </select>
      </div>

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
        <Plus size={15} /> Add Rep {repFrames > 0 ? `· ${repFrames} frames` : ''}
      </button>

      <p className="hint">
        <kbd>I</kbd>/<kbd>O</kbd> mark · <kbd>Enter</kbd> add · <kbd>←</kbd>/<kbd>→</kbd> step · <kbd>?</kbd> all keys
      </p>
    </div>
  );
}
