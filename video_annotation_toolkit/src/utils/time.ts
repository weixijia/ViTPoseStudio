/** Convert a frame index to seconds (fallback / display only — prefer exact per-frame timestamps from the engine). */
export function frameToSec(frame: number, fps: number): number {
  return fps > 0 ? frame / fps : 0;
}

/** Clamp a number into [min, max]. */
export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Format seconds as a SMPTE-style timecode HH:MM:SS:FF where FF is the frame
 * within the current second. Professional editors display position this way.
 */
export function formatTimecode(sec: number, fps: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const totalFrames = Math.round(sec * fps);
  const f = fps > 0 ? totalFrames % Math.round(fps) : 0;
  const totalSecs = Math.floor(sec);
  const s = totalSecs % 60;
  const m = Math.floor(totalSecs / 60) % 60;
  const h = Math.floor(totalSecs / 3600);
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}

/** Compact mm:ss.mmm clock for tables. */
export function formatClock(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(3).padStart(6, '0')}`;
}

/** Compact m:ss clock without milliseconds. */
export function formatMinSec(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
