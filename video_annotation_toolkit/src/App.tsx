import { useCallback, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { engine } from './engine/engineInstance';
import type { VideoSourceInput } from './engine/VideoEngine';
import { audioPlayer } from './engine/AudioPlayer';
import { skeleton } from './engine/skeleton';
import { useStore, registerEngineTimeLookup } from './state/useStore';
import { loadActionLabels, getEffectiveActions } from './utils/actionStore';
import { loadSavedAnnotations } from './utils/autosave';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import { useAutosave } from './hooks/useAutosave';
import VideoCanvas from './components/VideoCanvas';
import SkeletonCanvas from './components/SkeletonCanvas';
import ConfidenceBars from './components/ConfidenceBars';
import VideoLibrary from './components/VideoLibrary';
import TransportControls from './components/TransportControls';
import Timeline from './components/Timeline';
import AnnotationPanel from './components/AnnotationPanel';
import PoseErrorPanel from './components/PoseErrorPanel';
import RepTable from './components/RepTable';
import SaveStatus from './components/SaveStatus';
import ShortcutsOverlay from './components/ShortcutsOverlay';
import Tutorial from './components/Tutorial';

const WEBCODECS_OK = typeof window !== 'undefined' && 'VideoDecoder' in window;

export default function App() {
  const meta = useStore((s) => s.meta);
  const hasSkeleton = useStore((s) => s.hasSkeleton);
  const annotator = useStore((s) => s.annotator);
  const setAnnotator = useStore((s) => s.setAnnotator);
  const resetForNewVideo = useStore((s) => s.resetForNewVideo);
  const setActionTypes = useStore((s) => s.setActionTypes);
  const setHasSkeleton = useStore((s) => s.setHasSkeleton);
  const restoreAnnotations = useStore((s) => s.restoreAnnotations);
  const setAnnotationsReady = useStore((s) => s.setAnnotationsReady);
  const toggleShortcuts = useStore((s) => s.toggleShortcuts);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [skeletonWarning, setSkeletonWarning] = useState('');

  usePlayback();
  useKeyboard();
  useAutosave();

  const loadVideo = useCallback(
    async (src: VideoSourceInput, skeletonUrl?: string) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const m = await engine.load(src);
        registerEngineTimeLookup((frame) => engine.timeOfFrame(frame));
        if (engine.mediaUrl) audioPlayer.load(engine.mediaUrl);
        resetForNewVideo(m);
        const base = m.name.replace(/\.[^./\\]+$/, '');
        // per-video action labels: action_labels/<base>.json (falls back to built-in defaults)
        setActionTypes(getEffectiveActions(await loadActionLabels(base)));
        // frame-aligned MediaPipe skeleton (optional)
        const url = skeletonUrl ?? `/mediapipe_skeleton/${base}.json`;
        const sk = await skeleton.loadFromUrl(url);
        setHasSkeleton(!!sk);
        // non-blocking: a stale/short skeleton would silently misalign with the video
        if (sk && sk.frameCount !== m.frameCount) {
          setSkeletonWarning(
            `Skeleton frame count (${sk.frameCount}) ≠ video (${m.frameCount}) — re-run extraction; pose overlay may be misaligned.`,
          );
        } else {
          setSkeletonWarning('');
        }
        // restore prior annotations for this video (resume), THEN enable autosave
        restoreAnnotations(await loadSavedAnnotations(m.name));
        setAnnotationsReady(true);
        setStatus('idle');
      } catch (err) {
        skeleton.clear();
        setHasSkeleton(false);
        setErrorMsg((err as Error).message);
        setStatus('error');
      }
    },
    [resetForNewVideo, setActionTypes, setHasSkeleton, restoreAnnotations, setAnnotationsReady],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadVideo(f);
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadVideo(f);
  };

  if (!WEBCODECS_OK) {
    return (
      <div className="fullscreen-message">
        <div>
          <h1>Browser not supported</h1>
          <p>
            This tool needs the <strong>WebCodecs API</strong> for frame-accurate decoding.
            Please open it in <strong>Chrome</strong> or <strong>Edge</strong> (latest).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand"><span className="logo">◉</span> Rep Annotator</div>
        <label className="load-btn">
          Load video
          <input type="file" accept="video/*,.m4v,.mp4,.webm,.mov" onChange={onPick} hidden />
        </label>
        {meta && <span className="file-name" title={meta.name}>{meta.name}{hasSkeleton ? ' · skeleton ✓' : ''}</span>}
        <div className="spacer" />
        {meta && (
          <input
            className="annotator-input"
            placeholder="annotator name"
            value={annotator}
            onChange={(e) => setAnnotator(e.target.value)}
            title="Written into the CSV `annotator` column"
          />
        )}
        {meta && <SaveStatus />}
        <button className="help-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={toggleShortcuts}><HelpCircle size={18} /></button>
      </header>

      {skeletonWarning && (
        <div className="warn-banner" role="status">
          <span>⚠ {skeletonWarning}</span>
          <button aria-label="Dismiss warning" onClick={() => setSkeletonWarning('')}><X size={14} /></button>
        </div>
      )}

      {!meta ? (
        <div className="welcome">
          <div
            className={`welcome-left dropzone ${dragOver ? 'over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
          >
            {status === 'loading' ? (
              <div className="loading-box"><div className="spinner" /><p>Decoding &amp; indexing frames…</p></div>
            ) : status === 'error' ? (
              <div className="error-box">
                <h3>Could not load video</h3>
                <p>{errorMsg}</p>
                <label className="load-btn">Try another file<input type="file" accept="video/*" onChange={onPick} hidden /></label>
              </div>
            ) : (
              <>
                <div className="wl-head">
                  <div className="dropzone-logo">◉</div>
                  <h1>Video library</h1>
                  <p>Pick a video below to annotate, or drop a new file into the <code>videos/</code> folder and pre-process it here.</p>
                  <label className="load-btn big">
                    Choose video file
                    <input type="file" accept="video/*,.m4v,.mp4,.webm,.mov" onChange={onPick} hidden />
                  </label>
                </div>
                <VideoLibrary onSelect={(v) => loadVideo({ url: `/videos/${v}`, name: v })} />
              </>
            )}
          </div>
          <aside className="welcome-right">
            <Tutorial />
          </aside>
        </div>
      ) : (
        <div className="workspace">
          <div className="main-col">
            <div className="stage">
              <VideoCanvas />
              {hasSkeleton && (
                <div className="skeleton-col">
                  <SkeletonCanvas />
                  <ConfidenceBars />
                </div>
              )}
            </div>
            <TransportControls />
            <Timeline />
          </div>
          <aside className="side-col">
            <AnnotationPanel />
            {hasSkeleton && <PoseErrorPanel />}
            <RepTable />
          </aside>
        </div>
      )}

      {status === 'loading' && meta && <div className="toast">Loading…</div>}
      <ShortcutsOverlay />
    </div>
  );
}
