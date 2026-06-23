import { useEffect } from 'react';
import { useStore } from '../state/useStore';
import { getEffectiveActions } from '../utils/actionStore';

/** Is the user currently typing into a form field? If so, stay out of their way. */
function isEditingField(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

function nextForwardSpeed(s: number): number {
  if (s >= 4) return 1;
  if (s >= 1) return s * 2;
  return 1;
}
function nextReverseSpeed(s: number): number {
  if (s <= -4) return -1;
  if (s <= -1) return s * 2;
  return -1;
}

/** Global professional-editor keyboard shortcuts. */
export function useKeyboard() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const s = useStore.getState();

      // overlay: ? toggles, Esc closes — these work even over the modal
      if (e.code === 'Slash' && e.shiftKey) {
        e.preventDefault();
        s.toggleShortcuts();
        return;
      }
      if (e.code === 'Escape' && s.showShortcuts) {
        e.preventDefault();
        s.toggleShortcuts();
        return;
      }
      if (isEditingField(e.target)) return;
      if (!s.meta) return;

      const pauseThen = (fn: () => void) => {
        if (s.isPlaying) s.setPlaying(false);
        fn();
      };

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          s.togglePlay();
          return;
        case 'ArrowRight':
          e.preventDefault();
          pauseThen(() => s.stepFrame(e.shiftKey ? 10 : 1));
          return;
        case 'ArrowLeft':
          e.preventDefault();
          pauseThen(() => s.stepFrame(e.shiftKey ? -10 : -1));
          return;
        case 'KeyL':
          e.preventDefault();
          s.setSpeed(nextForwardSpeed(s.speed));
          s.setPlaying(true);
          return;
        case 'KeyJ':
          e.preventDefault();
          s.setSpeed(nextReverseSpeed(s.speed));
          s.setPlaying(true);
          return;
        case 'KeyK':
          e.preventDefault();
          s.setPlaying(false);
          s.setSpeed(1);
          return;
        case 'KeyI':
          e.preventDefault();
          if (e.shiftKey) s.snapBoundaryToPlayhead('start');
          else s.markIn();
          return;
        case 'KeyO':
          e.preventDefault();
          if (e.shiftKey) s.snapBoundaryToPlayhead('end');
          else s.markOut();
          return;
        case 'Enter':
          e.preventDefault();
          s.commitRep();
          return;
        case 'Escape':
          e.preventDefault();
          s.clearInOut();
          return;
        case 'Delete':
        case 'Backspace':
          if (s.selectedRepId) {
            e.preventDefault();
            s.deleteRep(s.selectedRepId);
          }
          return;
        case 'Comma':
          e.preventDefault();
          s.nudgeBoundary('start', -1);
          return;
        case 'Period':
          e.preventDefault();
          s.nudgeBoundary('start', 1);
          return;
        case 'Semicolon':
          e.preventDefault();
          s.nudgeBoundary('end', -1);
          return;
        case 'Quote':
          e.preventDefault();
          s.nudgeBoundary('end', 1);
          return;
        case 'Tab':
          e.preventDefault();
          s.selectAdjacentRep(e.shiftKey ? -1 : 1);
          return;
        case 'KeyS':
          e.preventDefault();
          s.toggleSnap();
          return;
        case 'KeyZ':
          if (e.shiftKey) {
            e.preventDefault();
            s.zoomToFit();
          }
          return;
        case 'BracketRight':
          e.preventDefault();
          s.setPxPerSec(s.pxPerSec * 1.5);
          return;
        case 'BracketLeft':
          e.preventDefault();
          s.setPxPerSec(s.pxPerSec / 1.5);
          return;
        case 'Home':
          e.preventDefault();
          pauseThen(() => s.setCurrentFrame(0));
          return;
        case 'End':
          e.preventDefault();
          pauseThen(() => s.setCurrentFrame(s.meta!.frameCount - 1));
          return;
      }

      // digit hotkeys select an action type (built-in or custom)
      if (/^Digit[1-9]$/.test(e.code)) {
        const key = e.code.slice(5);
        const action = getEffectiveActions(s.customActions).find((a) => a.hotkey === key);
        if (action) {
          e.preventDefault();
          s.setCurrentAction(action.id);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}
