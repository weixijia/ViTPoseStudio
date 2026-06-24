import { Check, Loader2, AlertTriangle } from 'lucide-react';
import { useStore } from '../state/useStore';
import { baseName } from '../utils/csv';

/** Shows where annotations auto-save and the current save state. */
export default function SaveStatus() {
  const status = useStore((s) => s.saveStatus);
  const meta = useStore((s) => s.meta);
  if (!meta) return null;
  const path = `annotation/${baseName(meta.name)}/`;

  return (
    <div className={`save-indicator ${status}`} title={`Auto-saving to ${path} (rep_counting.json + pose_analysis.json)`}>
      {status === 'saving' && (<><Loader2 size={14} className="spin" /> Saving…</>)}
      {status === 'error' && (<><AlertTriangle size={14} /> Save failed</>)}
      {(status === 'saved' || status === 'idle') && (<><Check size={14} /> <span className="si-path">{path}</span></>)}
    </div>
  );
}
