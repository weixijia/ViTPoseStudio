import { formatMinSec } from './time';

export type RulerLabelMode = 'frame' | 'msec' | 'sec' | 'clock';

export interface RulerStep {
  majorSec: number;
  minorSec: number;
  labelMode: RulerLabelMode;
}

/**
 * Choose tick spacing that adapts to zoom (px-per-second), like a pro editor's
 * ruler. Picks the smallest "nice" interval whose on-screen spacing is at least
 * `minMajorPx`, so labels never crowd. Sub-second intervals are frame-based.
 */
export function rulerStep(pxPerSec: number, fps: number, minMajorPx = 72): RulerStep {
  const frameSec = fps > 0 ? 1 / fps : 1 / 30;
  // candidate major intervals (seconds), ascending
  const candidates = [
    frameSec, frameSec * 2, frameSec * 5, frameSec * 10,
    0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800,
  ];
  let majorSec = candidates[candidates.length - 1];
  for (const c of candidates) {
    if (c * pxPerSec >= minMajorPx) {
      majorSec = c;
      break;
    }
  }
  // minor subdivisions
  let minorSec: number;
  if (majorSec < 1) minorSec = frameSec;
  else if (majorSec <= 2) minorSec = majorSec / (fps > 30 ? 5 : 4) || frameSec;
  else minorSec = majorSec / 5;

  const labelMode: RulerLabelMode =
    pxPerSec >= 16 / frameSec ? 'frame' : majorSec < 1 ? 'msec' : majorSec < 60 ? 'sec' : 'clock';

  return { majorSec, minorSec, labelMode };
}

/** Format a tick label according to the active mode. */
export function formatRulerLabel(sec: number, mode: RulerLabelMode, fps: number): string {
  switch (mode) {
    case 'frame':
      return `${Math.round(sec * fps)}`;
    case 'msec':
      return `${sec.toFixed(2)}s`;
    case 'sec':
      return formatMinSec(sec);
    case 'clock':
    default:
      return formatMinSec(sec);
  }
}

export interface SnapResult {
  time: number;
  snapped: boolean;
  target: number | null;
}

/**
 * Snap a time to the nearest candidate within a pixel threshold (screen-space).
 * Candidates are absolute times (playhead, other segment edges, t=0).
 */
export function snapTime(
  time: number,
  candidates: number[],
  pxPerSec: number,
  thresholdPx = 8,
): SnapResult {
  let best: number | null = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dist = Math.abs(c - time) * pxPerSec;
    if (dist < bestDist) {
      bestDist = dist;
      best = c;
    }
  }
  if (best !== null && bestDist <= thresholdPx) {
    return { time: best, snapped: true, target: best };
  }
  return { time, snapped: false, target: null };
}
