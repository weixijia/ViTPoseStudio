import type { Rep, VideoMeta } from '../types';

/** CSV column order. Adjust freely here if you change the export schema later. */
const COLUMNS = [
  'video_filename',
  'video_fps',
  'action_type',
  'rep_index',
  'start_frame',
  'end_frame',
  'start_time_sec',
  'end_time_sec',
  'duration_sec',
  'annotator',
  'notes',
] as const;

function escapeCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV string where each row is exactly one rep. */
export function repsToCsv(reps: Rep[], meta: VideoMeta, annotator: string): string {
  const header = COLUMNS.join(',');
  const rows = reps.map((r) => {
    const duration = r.endTimeSec - r.startTimeSec;
    const cells: Record<(typeof COLUMNS)[number], string | number> = {
      video_filename: meta.name,
      video_fps: meta.fps.toFixed(6),
      action_type: r.actionType,
      rep_index: r.repIndex,
      start_frame: r.startFrame,
      end_frame: r.endFrame,
      start_time_sec: r.startTimeSec.toFixed(6),
      end_time_sec: r.endTimeSec.toFixed(6),
      duration_sec: duration.toFixed(6),
      annotator,
      notes: r.notes ?? '',
    };
    return COLUMNS.map((c) => escapeCell(cells[c])).join(',');
  });
  return [header, ...rows].join('\n');
}

/** Trigger a browser download of arbitrary text content. */
export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Strip the extension from a filename for use as an export base name. */
export function baseName(name: string): string {
  return name.replace(/\.[^./\\]+$/, '') || 'project';
}
