import { useRef } from 'react';
import { useStore } from '../state/useStore';
import { engine } from '../engine/engineInstance';
import { repsToCsv, poseErrorsToCsv, downloadText, baseName } from '../utils/csv';
import { exportActionsFile, importActionsFile, mergeActions, saveCustomActions } from '../utils/actionStore';
import type { ProjectState } from '../types';

export default function ExportBar() {
  const meta = useStore((s) => s.meta);
  const reps = useStore((s) => s.reps);
  const poseErrors = useStore((s) => s.poseErrors);
  const poseDirty = useStore((s) => s.poseDirty);
  const annotator = useStore((s) => s.annotator);
  const customActions = useStore((s) => s.customActions);
  const setCustomActions = useStore((s) => s.setCustomActions);
  const loadProject = useStore((s) => s.loadProject);
  const projectFileRef = useRef<HTMLInputElement>(null);
  const actionsFileRef = useRef<HTMLInputElement>(null);

  if (!meta) return null;

  const poseErrorCount = Object.keys(poseErrors).length;

  const exportCsv = () => {
    downloadText(`${baseName(meta.name)}_reps.csv`, repsToCsv(reps, meta, annotator), 'text/csv');
  };

  const exportPoseCsv = () => {
    useStore.getState().savePoseDraft(); // commit the frame being edited
    const pe = useStore.getState().poseErrors;
    downloadText(
      `${baseName(meta.name)}_pose_errors.csv`,
      poseErrorsToCsv(pe, meta, (f) => engine.timeOfFrame(f)),
      'text/csv',
    );
  };

  const saveProject = () => {
    useStore.getState().savePoseDraft(); // commit the frame being edited
    const project: ProjectState = {
      version: 2,
      videoName: meta.name,
      fps: meta.fps,
      frameCount: meta.frameCount,
      durationSec: meta.durationSec,
      annotator,
      reps,
      customActions,
      poseErrors: useStore.getState().poseErrors,
      savedAt: new Date().toISOString(),
    };
    downloadText(`${baseName(meta.name)}_project.json`, JSON.stringify(project, null, 2), 'application/json');
  };

  const onLoadProject = async (file: File) => {
    try {
      const project = JSON.parse(await file.text()) as ProjectState;
      if (!Array.isArray(project.reps)) throw new Error('Invalid project file');
      if (project.videoName !== meta.name && !confirm(
        `This project was saved for "${project.videoName}", but the loaded video is "${meta.name}". Load anyway?`,
      )) return;
      loadProject(project, meta);
      if (Array.isArray(project.customActions) && project.customActions.length) {
        const merged = mergeActions(customActions, project.customActions);
        setCustomActions(merged);
        saveCustomActions(meta.name, merged);
      }
    } catch (err) {
      alert(`Could not load project: ${(err as Error).message}`);
    }
  };

  const onImportActions = async (file: File) => {
    try {
      const parsed = await importActionsFile(file);
      const merged = mergeActions(customActions, parsed.actions);
      setCustomActions(merged);
      saveCustomActions(meta.name, merged);
    } catch (err) {
      alert(`Could not import actions: ${(err as Error).message}`);
    }
  };

  return (
    <div className="export-bar">
      <button onClick={exportCsv} disabled={reps.length === 0} title="Export one CSV row per rep">⬇ Reps</button>
      <button onClick={exportPoseCsv} disabled={poseErrorCount === 0 && !poseDirty} title="Export one CSV row per flagged frame">⬇ Pose</button>
      <button onClick={saveProject} className="ghost" title="Save annotation project (JSON)">💾 Save</button>
      <button onClick={() => projectFileRef.current?.click()} className="ghost" title="Load a saved project">📂 Load</button>
      <span className="tl-divider" />
      <button onClick={() => exportActionsFile(meta.name, customActions)} className="ghost" disabled={customActions.length === 0} title="Export this video's custom action list">⬇ Actions</button>
      <button onClick={() => actionsFileRef.current?.click()} className="ghost" title="Import a custom action list">📂 Actions</button>

      <input ref={projectFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onLoadProject(f); e.target.value = ''; }} />
      <input ref={actionsFileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportActions(f); e.target.value = ''; }} />
    </div>
  );
}
