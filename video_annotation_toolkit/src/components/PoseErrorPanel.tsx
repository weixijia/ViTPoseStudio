import { useEffect, useMemo } from 'react';
import { X, Save } from 'lucide-react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { POSE_ERROR_LABELS } from '../config/poseErrors.config';
import { formatTimecode } from '../utils/time';

export default function PoseErrorPanel() {
  const meta = useStore((s) => s.meta);
  const hasSkeleton = useStore((s) => s.hasSkeleton);
  const currentFrame = useStore((s) => s.currentFrame);
  const poseErrors = useStore((s) => s.poseErrors);
  const draftLabels = useStore((s) => s.poseDraftLabels);
  const draftNote = useStore((s) => s.poseDraftNote);
  const dirty = useStore((s) => s.poseDirty);
  const skeletonBackdrop = useStore((s) => s.skeletonBackdrop);
  const beginPoseDraft = useStore((s) => s.beginPoseDraft);
  const toggleDraftLabel = useStore((s) => s.toggleDraftLabel);
  const setDraftNote = useStore((s) => s.setDraftNote);
  const savePoseDraft = useStore((s) => s.savePoseDraft);
  const revertPoseDraft = useStore((s) => s.revertPoseDraft);
  const clearPoseFrame = useStore((s) => s.clearPoseFrame);
  const toggleSkeletonBackdrop = useStore((s) => s.toggleSkeletonBackdrop);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setPlaying = useStore((s) => s.setPlaying);

  // load the draft for whatever frame we land on (auto-saves the one we leave)
  useEffect(() => {
    beginPoseDraft(currentFrame);
  }, [currentFrame, beginPoseDraft]);

  const flaggedFrames = useMemo(
    () => Object.keys(poseErrors).map(Number).sort((a, b) => a - b),
    [poseErrors],
  );

  if (!meta) return null;

  const committed = poseErrors[currentFrame];
  const labelName = (id: string) => POSE_ERROR_LABELS.find((l) => l.id === id)?.label ?? id;

  return (
    <div className="panel pose-panel">
      <h2>
        Pose Review <span className="count">{flaggedFrames.length}</span>
        <button
          className={`backdrop-toggle ${skeletonBackdrop ? 'active' : ''}`}
          title="Show the RGB frame behind the skeleton"
          onClick={toggleSkeletonBackdrop}
        >
          {skeletonBackdrop ? 'RGB on' : 'RGB off'}
        </button>
      </h2>

      {!hasSkeleton ? (
        <p className="empty-sub">
          No MediaPipe skeleton for this video. Pre-extract it:
          <br /><code>python tools/extract_mediapipe.py</code>
        </p>
      ) : (
        <>
          <div className="error-chips">
            {POSE_ERROR_LABELS.map((l) => {
              const on = draftLabels.includes(l.id);
              return (
                <button
                  key={l.id}
                  className={`chip ${on ? 'on' : ''}`}
                  title={l.hotkey ? `Toggle (${l.hotkey.toUpperCase()})` : 'Toggle'}
                  onClick={() => toggleDraftLabel(l.id)}
                >
                  {l.label}{l.hotkey ? <span className="chip-key">{l.hotkey}</span> : null}
                </button>
              );
            })}
          </div>
          <textarea
            className="error-note"
            rows={2}
            placeholder="note (optional) — drag corner to expand"
            value={draftNote}
            onChange={(e) => setDraftNote(e.target.value)}
          />

          <div className="save-row">
            <button className="save-btn" disabled={!dirty} onClick={savePoseDraft} title="Save this frame's flag (Ctrl/Cmd+S)">
              <Save size={14} /> Save frame
            </button>
            {dirty ? (
              <span className="save-status unsaved">● Unsaved changes</span>
            ) : committed ? (
              <span className="save-status saved">✓ Saved</span>
            ) : (
              <span className="save-status none">not flagged</span>
            )}
            {dirty && <button className="ghost small" onClick={revertPoseDraft} title="Discard edits to this frame">Revert</button>}
            {committed && !dirty && (
              <button className="ghost small danger" onClick={() => clearPoseFrame(currentFrame)} title="Remove this frame's flag">Clear</button>
            )}
          </div>

          {flaggedFrames.length > 0 && (
            <div className="flagged-list">
              {flaggedFrames.map((f) => {
                const pe = poseErrors[f];
                return (
                  <div key={f} className={`flagged-row ${f === currentFrame ? 'current' : ''}`}>
                    <button className="link" onClick={() => { setPlaying(false); setCurrentFrame(f); }}>{f}</button>
                    <span className="flagged-tc">{formatTimecode(engine.timeOfFrame(f), meta.fps)}</span>
                    <span className="flagged-labels" title={pe.labels.map(labelName).join(', ')}>
                      {pe.labels.map(labelName).join(', ') || (pe.note ? '(note)' : '')}
                    </span>
                    <button className="danger" aria-label={`Clear flag on frame ${f}`} title="Clear" onClick={() => clearPoseFrame(f)}><X size={13} /></button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
