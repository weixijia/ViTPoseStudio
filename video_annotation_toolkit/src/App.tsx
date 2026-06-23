import { useCallback, useState } from 'react';
import { engine } from './engine/engineInstance';
import { useStore, registerEngineTimeLookup } from './state/useStore';
import { loadCustomActions } from './utils/actionStore';
import { usePlayback } from './hooks/usePlayback';
import { useKeyboard } from './hooks/useKeyboard';
import VideoCanvas from './components/VideoCanvas';
import TransportControls from './components/TransportControls';
import Timeline from './components/Timeline';
import AnnotationPanel from './components/AnnotationPanel';
import RepTable from './components/RepTable';
import ExportBar from './components/ExportBar';
import ShortcutsOverlay from './components/ShortcutsOverlay';

const WEBCODECS_OK = typeof window !== 'undefined' && 'VideoDecoder' in window;

export default function App() {
  const meta = useStore((s) => s.meta);
  const annotator = useStore((s) => s.annotator);
  const setAnnotator = useStore((s) => s.setAnnotator);
  const resetForNewVideo = useStore((s) => s.resetForNewVideo);
  const setCustomActions = useStore((s) => s.setCustomActions);
  const toggleShortcuts = useStore((s) => s.toggleShortcuts);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dragOver, setDragOver] = useState(false);

  usePlayback();
  useKeyboard();

  const loadFile = useCallback(
    async (file: File) => {
      setStatus('loading');
      setErrorMsg('');
      try {
        const m = await engine.load(file);
        registerEngineTimeLookup((frame) => engine.timeOfFrame(frame));
        resetForNewVideo(m);
        setCustomActions(loadCustomActions(m.name));
        setStatus('idle');
      } catch (err) {
        setErrorMsg((err as Error).message);
        setStatus('error');
      }
    },
    [resetForNewVideo, setCustomActions],
  );

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) loadFile(f);
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) loadFile(f);
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
          {meta ? 'Load video' : 'Load video'}
          <input type="file" accept="video/*,.m4v,.mp4,.webm,.mov" onChange={onPick} hidden />
        </label>
        {meta && <span className="file-name" title={meta.name}>{meta.name}</span>}
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
        <button className="help-btn" title="Keyboard shortcuts (?)" onClick={toggleShortcuts}>?</button>
      </header>

      {!meta ? (
        <div
          className={`dropzone ${dragOver ? 'over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {status === 'loading' ? (
            <div className="loading-box">
              <div className="spinner" />
              <p>Decoding &amp; indexing frames…</p>
            </div>
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
              <p className="dropzone-hint">Press <kbd>?</kbd> anytime for keyboard shortcuts · Chrome / Edge recommended</p>
            </>
          )}
        </div>
      ) : (
        <div className="workspace">
          <div className="main-col">
            <VideoCanvas />
            <TransportControls />
            <Timeline />
          </div>
          <aside className="side-col">
            <AnnotationPanel />
            <RepTable />
          </aside>
        </div>
      )}

      {status === 'loading' && meta && <div className="toast">Loading…</div>}
      <ShortcutsOverlay />
    </div>
  );
}
