import { useCallback, useEffect, useState } from 'react';
import { engine } from './engine/engineInstance';
import type { VideoSourceInput } from './engine/VideoEngine';
import { audioPlayer } from './engine/AudioPlayer';
import { skeleton } from './engine/skeleton';
import { useStore, registerEngineTimeLookup } from './state/useStore';
import { loadCustomActions } from './utils/actionStore';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import VideoCanvas from './components/VideoCanvas';
import SkeletonCanvas from './components/SkeletonCanvas';
import TransportControls from './components/TransportControls';
import Timeline from './components/Timeline';
import AnnotationPanel from './components/AnnotationPanel';
import PoseErrorPanel from './components/PoseErrorPanel';
import RepTable from './components/RepTable';
import ExportBar from './components/ExportBar';
import ShortcutsOverlay from './components/ShortcutsOverlay';

const WEBCODECS_OK = typeof window !== 'undefined' && 'VideoDecoder' in window;

interface ManifestEntry {
  video: string;
  skeleton: string;
  frame_count?: number;
  fps?: number;
}

export default function App() {
  const meta = useStore((s) => s.meta);
  const hasSkeleton = useStore((s) => s.hasSkeleton);
  const annotator = useStore((s) => s.annotator);
  const setAnnotator = useStore((s) => s.setAnnotator);
  const resetForNewVideo = useStore((s) => s.resetForNewVideo);
  const setCustomActions = useStore((s) => s.setCustomActions);
  const setHasSkeleton = useStore((s) => s.setHasSkeleton);
  const toggleShortcuts = useStore((s) => s.toggleShortcuts);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [manifest, setManifest] = useState<ManifestEntry[]>([]);
  const [skeletonWarning, setSkeletonWarning] = useState('');

  usePlayback();
  useKeyboard();

  // discover pre-processed videos (videos/ + mediapipe_skeleton/) served by the dev server
  useEffect(() => {
    fetch('/mediapipe_skeleton/manifest.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d && Array.isArray(d.videos)) setManifest(d.videos); })
      .catch(() => {});
  }, []);

  const loadVideo = useCallback(
    async (src: VideoSourceInput, skeletonUrl?: string) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const m = await engine.load(src);
        registerEngineTimeLookup((frame) => engine.timeOfFrame(frame));
        if (engine.mediaUrl) audioPlayer.load(engine.mediaUrl);
        resetForNewVideo(m);
        setCustomActions(loadCustomActions(m.name));
        // frame-aligned MediaPipe skeleton (optional)
        const base = m.name.replace(/\.[^./\\]+$/, '');
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
        setStatus('idle');
      } catch (err) {
        skeleton.clear();
        setHasSkeleton(false);
        setErrorMsg((err as Error).message);
        setStatus('error');
      }
    },
    [resetForNewVideo, setCustomActions, setHasSkeleton],
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
        {meta && <ExportBar />}
        <button className="help-btn" aria-label="Keyboard shortcuts" title="Keyboard shortcuts (?)" onClick={toggleShortcuts}>?</button>
      </header>

      {skeletonWarning && (
        <div className="warn-banner" role="status">
          ⚠ {skeletonWarning}
          <button aria-label="Dismiss warning" onClick={() => setSkeletonWarning('')}>×</button>
        </div>
      )}

      {!meta ? (
        <div
          className={`dropzone ${dragOver ? 'over' : ''}`}
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
              <div className="dropzone-logo">◉</div>
              <h1>Drop a video to start</h1>
              <p>
                Frame-accurate annotation for fitness rep counting. Everything runs locally —
                your video never leaves this machine.
              </p>
              <label className="load-btn big">
                Choose video file
                <input type="file" accept="video/*,.m4v,.mp4,.webm,.mov" onChange={onPick} hidden />
              </label>

              {manifest.length > 0 && (
                <div className="manifest-list">
                  <h3>Pre-processed videos <span className="manifest-sub">(with MediaPipe skeleton)</span></h3>
                  {manifest.map((e) => (
                    <button
                      key={e.video}
                      className="manifest-item"
                      onClick={() => loadVideo({ url: `/videos/${e.video}`, name: e.video }, `/mediapipe_skeleton/${e.skeleton}`)}
                    >
                      <span className="mi-name">{e.video}</span>
                      <span className="mi-meta">{e.frame_count ? `${e.frame_count} frames` : ''} · skeleton ✓</span>
                    </button>
                  ))}
                </div>
              )}
              <p className="dropzone-hint">Press <kbd>?</kbd> anytime for shortcuts · Chrome / Edge recommended</p>
            </>
          )}
        </div>
      ) : (
        <div className="workspace">
          <div className="main-col">
            <div className="stage">
              <VideoCanvas />
              {hasSkeleton && <SkeletonCanvas />}
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
