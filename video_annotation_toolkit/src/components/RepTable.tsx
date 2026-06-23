import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { formatClock } from '../utils/time';

export default function RepTable() {
  const meta = useStore((s) => s.meta);
  const reps = useStore((s) => s.reps);
  const selectedRepId = useStore((s) => s.selectedRepId);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectRep = useStore((s) => s.selectRep);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setPlaying = useStore((s) => s.setPlaying);
  const deleteRep = useStore((s) => s.deleteRep);
  const updateRep = useStore((s) => s.updateRep);

  if (!meta) return null;

  const jump = (frame: number) => {
    setPlaying(false);
    setCurrentFrame(frame);
  };

  return (
    <div className="panel rep-table-panel">
      <h2>Reps <span className="count">{reps.length}</span></h2>
      {reps.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">⟦ ⟧</div>
          <p>No reps yet.</p>
          <p className="empty-sub">Mark In/Out on the timeline and press <kbd>Enter</kbd>.</p>
        </div>
      ) : (
        <div className="rep-table-scroll">
          <table className="rep-table">
            <thead>
              <tr>
                <th>action</th>
                <th>#</th>
                <th>start</th>
                <th>end</th>
                <th>dur</th>
                <th>notes</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {reps.map((r) => {
                const dur = r.endTimeSec - r.startTimeSec;
                const isCurrent = currentFrame >= r.startFrame && currentFrame <= r.endFrame;
                return (
                  <tr
                    key={r.id}
                    className={`${r.id === selectedRepId ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                    onClick={() => selectRep(r.id)}
                  >
                    <td className="action-cell" title={r.actionType}>{r.actionType}</td>
                    <td>{r.repIndex}</td>
                    <td>
                      <button className="link" onClick={(e) => { e.stopPropagation(); jump(r.startFrame); }}>
                        {r.startFrame}
                      </button>
                    </td>
                    <td>
                      <button className="link" onClick={(e) => { e.stopPropagation(); jump(r.endFrame); }}>
                        {r.endFrame}
                      </button>
                    </td>
                    <td>{formatClock(dur)}</td>
                    <td className="notes-cell">
                      <input
                        value={r.notes}
                        placeholder="…"
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateRep(r.id, { notes: e.target.value })}
                      />
                    </td>
                    <td className="row-actions">
                      <button
                        title="Set start to current frame"
                        onClick={(e) => {
                          e.stopPropagation();
                          const f = useStore.getState().currentFrame;
                          if (f <= r.endFrame) updateRep(r.id, { startFrame: f, startTimeSec: engine.timeOfFrame(f) });
                        }}
                      >⟦</button>
                      <button
                        title="Set end to current frame"
                        onClick={(e) => {
                          e.stopPropagation();
                          const f = useStore.getState().currentFrame;
                          if (f >= r.startFrame) updateRep(r.id, { endFrame: f, endTimeSec: engine.timeOfFrame(f) });
                        }}
                      >⟧</button>
                      <button
                        className="danger"
                        title="Delete rep (Del)"
                        onClick={(e) => { e.stopPropagation(); deleteRep(r.id); }}
                      >✕</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
