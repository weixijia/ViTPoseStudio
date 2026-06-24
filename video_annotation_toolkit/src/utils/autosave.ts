import type { Rep, PoseError, VideoMeta } from '../types';
import { engine } from '../engine/engineInstance';
import { baseName } from './csv';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export const REP_FILE = 'rep_counting.json';
export const POSE_FILE = 'pose_analysis.json';

/** Build the rep-counting JSON (one object per rep). */
export function buildRepData(meta: VideoMeta, reps: Rep[], annotator: string) {
  return {
    video: meta.name,
    fps: meta.fps,
    frame_count: meta.frameCount,
    annotator,
    reps: reps.map((r) => ({
      action_type: r.actionType,
      rep_index: r.repIndex,
      start_frame: r.startFrame,
      end_frame: r.endFrame,
      n_frames: r.endFrame - r.startFrame + 1,
      start_time_sec: Number(r.startTimeSec.toFixed(6)),
      end_time_sec: Number(r.endTimeSec.toFixed(6)),
      duration_sec: Number((r.endTimeSec - r.startTimeSec).toFixed(6)),
      notes: r.notes ?? '',
    })),
    saved_at: new Date().toISOString(),
  };
}

/** Build the pose-analysis JSON (one object per flagged frame). */
export function buildPoseData(meta: VideoMeta, poseErrors: Record<number, PoseError>) {
  const frames = Object.keys(poseErrors).map(Number).sort((a, b) => a - b);
  return {
    video: meta.name,
    fps: meta.fps,
    frame_count: meta.frameCount,
    pose_errors: frames.map((f) => ({
      frame: f,
      time_sec: Number(engine.timeOfFrame(f).toFixed(6)),
      labels: poseErrors[f].labels,
      note: poseErrors[f].note,
    })),
    saved_at: new Date().toISOString(),
  };
}

/** POST a JSON payload to the dev-server endpoint, which writes annotation/<video>/<file>. */
export async function postAnnotation(videoName: string, file: string, data: unknown): Promise<boolean> {
  try {
    const res = await fetch('/__save_annotation', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ video: baseName(videoName), file, data }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Best-effort flush on page close (debounced saves may not have fired yet). */
export function beaconSave(videoName: string, file: string, data: unknown) {
  try {
    const blob = new Blob([JSON.stringify({ video: baseName(videoName), file, data })], {
      type: 'application/json',
    });
    navigator.sendBeacon('/__save_annotation', blob);
  } catch {
    /* ignore */
  }
}

export interface RestoredAnnotations {
  reps: Rep[];
  poseErrors: Record<number, PoseError>;
  annotator: string;
}

/** Load previously-saved annotations for a video (so reopening resumes work). */
export async function loadSavedAnnotations(videoName: string): Promise<RestoredAnnotations> {
  const base = baseName(videoName);
  const out: RestoredAnnotations = { reps: [], poseErrors: {}, annotator: '' };

  try {
    const r = await fetch(`/annotation/${encodeURIComponent(base)}/${REP_FILE}`);
    if (r.ok) {
      const d = await r.json();
      out.annotator = d.annotator ?? '';
      out.reps = (d.reps ?? []).map((x: Record<string, unknown>, i: number): Rep => ({
        id: `rep_loaded_${i}`,
        actionType: String(x.action_type ?? ''),
        repIndex: Number(x.rep_index ?? i + 1),
        startFrame: Number(x.start_frame ?? 0),
        endFrame: Number(x.end_frame ?? 0),
        startTimeSec: Number(x.start_time_sec ?? 0),
        endTimeSec: Number(x.end_time_sec ?? 0),
        notes: String(x.notes ?? ''),
      }));
    }
  } catch {
    /* none yet */
  }

  try {
    const p = await fetch(`/annotation/${encodeURIComponent(base)}/${POSE_FILE}`);
    if (p.ok) {
      const d = await p.json();
      for (const e of d.pose_errors ?? []) {
        out.poseErrors[Number(e.frame)] = { labels: e.labels ?? [], note: e.note ?? '' };
      }
    }
  } catch {
    /* none yet */
  }

  return out;
}
