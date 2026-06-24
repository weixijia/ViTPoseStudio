import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Cpu } from 'lucide-react';

interface Job {
  status: 'queued' | 'running' | 'done' | 'error';
  done: number;
  total: number;
  error?: string;
}
interface LibEntry {
  video: string;
  skeleton: boolean;
  skeletonFrames: number | null;
  labels: boolean;
  reps: number;
  poseFlags: number;
  progressPct: number;
  job: Job | null;
}
interface PyStatus {
  ok: boolean;
  path: string | null;
  reason: 'OK' | 'MODULE_MISSING' | 'NO_PYTHON';
  fix: string;
}

/**
 * Welcome-page video library: lists everything in videos/ with its preprocessing + annotation
 * status, and lets the instructor batch-run MediaPipe pre-processing (one video at a time) with
 * a live progress bar per row. Polls the dev-server /__library endpoint.
 */
export default function VideoLibrary({ onSelect }: { onSelect: (video: string) => void }) {
  const [entries, setEntries] = useState<LibEntry[]>([]);
  const [py, setPy] = useState<PyStatus | null>(null);
  const [available, setAvailable] = useState(true);
  const timer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch('/__library');
      if (!r.ok) { setAvailable(false); return; }
      const d = await r.json();
      setEntries(d.videos ?? []);
      setPy(d.python ?? null);
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    timer.current = window.setInterval(refresh, 1000);
    return () => clearInterval(timer.current);
  }, [refresh]);

  const process = async (videos: string[], force = false) => {
    if (!videos.length) return;
    await fetch('/__preprocess', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ videos, force }),
    });
    refresh();
  };

  if (!available) return null; // endpoint absent (e.g. a static build) — hide the library
  if (entries.length === 0) {
    return (
      <p className="lib-empty">
        No videos in <code>videos/</code> yet. Copy video files into that folder — they'll appear here
        to pre-process and annotate.
      </p>
    );
  }

  const missing = entries.filter((e) => !e.skeleton).map((e) => e.video);
  const busy = entries.some((e) => e.job?.status === 'running' || e.job?.status === 'queued');
  const withSkel = entries.filter((e) => e.skeleton).length;
  const pyReady = !py || py.ok; // null = endpoint hasn't answered yet; treat as ok until known

  return (
    <div className="library">
      <div className="lib-toolbar">
        <span className="lib-count">{entries.length} video{entries.length === 1 ? '' : 's'} · {withSkel} with skeleton</span>
        {missing.length > 0 && (
          <button
            onClick={() => process(missing)}
            disabled={busy || !pyReady}
            title={pyReady ? 'Run MediaPipe on videos that have no skeleton yet' : 'Set up MediaPipe first (see below)'}
          >
            <Cpu size={14} /> Pre-process {missing.length} new
          </button>
        )}
      </div>

      {py && !py.ok && (
        <div className="lib-py-warn" role="status">
          <strong>Pose pre-processing isn’t set up.</strong>{' '}
          {py.reason === 'MODULE_MISSING'
            ? 'Python is installed, but MediaPipe/OpenCV are missing.'
            : 'No suitable Python interpreter was found.'}{' '}
          Run <code>npm run setup</code> once to create the bundled environment, then restart the dev server — preprocessing then works automatically. (You can still annotate videos that already have a skeleton.)
        </div>
      )}

      <div className="lib-rows" role="table">
        {entries.map((e) => {
          const job = e.job;
          const processing = job?.status === 'running' || job?.status === 'queued';
          const pct = job && job.total ? Math.round((job.done / job.total) * 100) : 0;
          return (
            <div key={e.video} className="lib-row" role="row">
              <button className="lib-name" onClick={() => onSelect(e.video)} title="Open for annotation">
                {e.video}
              </button>
              <span className={`lib-flag ${e.skeleton ? 'on' : ''}`} title={e.skeleton ? `skeleton: ${e.skeletonFrames ?? '?'} frames` : 'no skeleton'}>
                {e.skeleton ? <Check size={12} /> : '–'} pose
              </span>
              <span className={`lib-flag ${e.labels ? 'on' : ''}`} title={e.labels ? 'action_labels present' : 'no action_labels yet'}>
                {e.labels ? <Check size={12} /> : '–'} labels
              </span>
              <div className="lib-progress">
                {processing ? (
                  <>
                    <div className="bar proc"><span style={{ width: `${pct}%` }} /></div>
                    <span className="lib-pct">{job!.status === 'queued' ? 'queued…' : `processing ${pct}%`}</span>
                  </>
                ) : job?.status === 'error' ? (
                  <span className="lib-err" title={job.error}>⚠ failed — check MediaPipe / Python</span>
                ) : (
                  <>
                    <div className="bar ann"><span style={{ width: `${e.progressPct}%` }} /></div>
                    <span className="lib-pct">{e.progressPct}% · {e.reps} reps{e.poseFlags ? ` · ${e.poseFlags} flags` : ''}</span>
                  </>
                )}
              </div>
              <button className="lib-open ghost" onClick={() => onSelect(e.video)}>Annotate</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
