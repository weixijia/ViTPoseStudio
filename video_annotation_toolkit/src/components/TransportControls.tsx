import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { formatTimecode } from '../utils/time';

export default function TransportControls() {
  const meta = useStore((s) => s.meta);
  const currentFrame = useStore((s) => s.currentFrame);
  const isPlaying = useStore((s) => s.isPlaying);
  const speed = useStore((s) => s.speed);
  const muted = useStore((s) => s.muted);
  const toggleMuted = useStore((s) => s.toggleMuted);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const stepFrame = useStore((s) => s.stepFrame);
  const togglePlay = useStore((s) => s.togglePlay);
  const setPlaying = useStore((s) => s.setPlaying);
  const setSpeed = useStore((s) => s.setSpeed);

  if (!meta) return null;

  const timeSec = engine.timeOfFrame(currentFrame);
  const step = (d: number) => {
    setPlaying(false);
    stepFrame(d);
  };
  const goto = (f: number) => {
    setPlaying(false);
    setCurrentFrame(f);
  };

  return (
    <div className="transport">
      <div className="transport-group">
        <button aria-label="First frame" title="First frame (Home)" onClick={() => goto(0)}>⏮</button>
        <button className="frame-btn" aria-label="Back 10 frames" title="Back 10 frames (Shift+←)" onClick={() => step(-10)}>−10f</button>
        <button className="frame-btn" aria-label="Previous frame" title="Previous frame (←)" onClick={() => step(-1)}>◀ 1f</button>
        <button className="play" aria-label={isPlaying ? 'Pause' : 'Play'} aria-pressed={isPlaying} title="Play / Pause (Space)" onClick={togglePlay}>
          {isPlaying ? '❙❙' : '▶'}
        </button>
        <button className="frame-btn" aria-label="Next frame" title="Next frame (→)" onClick={() => step(1)}>1f ▶</button>
        <button className="frame-btn" aria-label="Forward 10 frames" title="Forward 10 frames (Shift+→)" onClick={() => step(10)}>+10f</button>
        <button aria-label="Last frame" title="Last frame (End)" onClick={() => goto(meta.frameCount - 1)}>⏭</button>
      </div>

      <div className="transport-readout">
        <span className="timecode" title="HH:MM:SS:FF">{formatTimecode(timeSec, meta.fps)}</span>
        <span className="frame-readout">
          frame <strong>{currentFrame}</strong> <span className="dim">/ {meta.frameCount - 1}</span>
        </span>
      </div>

      <div className="transport-group speed-group">
        <button className="mute-btn" aria-label={muted ? 'Unmute audio' : 'Mute audio'} aria-pressed={muted} title={muted ? 'Unmute' : 'Mute'} onClick={toggleMuted}>
          {muted ? '🔇' : '🔊'}
        </button>
        <label>Speed</label>
        {[0.25, 0.5, 1, 2, 4].map((sp) => (
          <button key={sp} className={`spd ${speed === sp ? 'active' : ''}`} onClick={() => setSpeed(sp)}>
            {sp}×
          </button>
        ))}
        {speed < 0 && <span className="rev-indicator">◀ {Math.abs(speed)}× rev</span>}
      </div>
    </div>
  );
}
