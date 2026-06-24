import { useEffect } from 'react';
import { useStore } from '../state/useStore';
import { postAnnotation, beaconSave, buildRepData, buildPoseData, REP_FILE, POSE_FILE } from '../utils/autosave';

/**
 * Persists annotations to disk automatically — no download dialogs. Each change to the
 * reps or pose flags is debounced and written to annotation/<video>/rep_counting.json
 * and pose_analysis.json via the dev-server endpoint. Saving is gated on `annotationsReady`
 * so loading a video's prior work doesn't immediately overwrite it.
 */
export function useAutosave() {
  const meta = useStore((s) => s.meta);
  const reps = useStore((s) => s.reps);
  const annotator = useStore((s) => s.annotator);
  const poseErrors = useStore((s) => s.poseErrors);
  const setSaveStatus = useStore((s) => s.setSaveStatus);

  // rep_counting.json — on rep / annotator changes
  useEffect(() => {
    if (!meta || !useStore.getState().annotationsReady) return;
    setSaveStatus('saving');
    const id = window.setTimeout(async () => {
      const ok = await postAnnotation(meta.name, REP_FILE, buildRepData(meta, reps, annotator));
      setSaveStatus(ok ? 'saved' : 'error');
    }, 500);
    return () => clearTimeout(id);
  }, [reps, annotator, meta, setSaveStatus]);

  // pose_analysis.json — on pose-error changes
  useEffect(() => {
    if (!meta || !useStore.getState().annotationsReady) return;
    setSaveStatus('saving');
    const id = window.setTimeout(async () => {
      const ok = await postAnnotation(meta.name, POSE_FILE, buildPoseData(meta, poseErrors));
      setSaveStatus(ok ? 'saved' : 'error');
    }, 500);
    return () => clearTimeout(id);
  }, [poseErrors, meta, setSaveStatus]);

  // flush any pending change when the tab is closed/hidden
  useEffect(() => {
    const flush = () => {
      const s = useStore.getState();
      if (!s.meta || !s.annotationsReady) return;
      beaconSave(s.meta.name, REP_FILE, buildRepData(s.meta, s.reps, s.annotator));
      beaconSave(s.meta.name, POSE_FILE, buildPoseData(s.meta, s.poseErrors));
    };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
}
