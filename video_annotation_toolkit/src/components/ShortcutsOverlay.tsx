import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useStore } from '../state/useStore';

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Playback',
    rows: [
      ['Space', 'Play / Pause'],
      ['← / →', 'Step ∓1 frame'],
      ['Shift + ← / →', 'Step ∓10 frames'],
      ['J / K / L', 'Shuttle reverse / stop / forward'],
      ['Home / End', 'First / last frame'],
    ],
  },
  {
    title: 'Marking',
    rows: [
      ['I / O', 'Mark In / Out'],
      ['Enter', 'Add rep'],
      ['Esc', 'Clear In/Out'],
      ['1 – 9', 'Select action type'],
    ],
  },
  {
    title: 'Edit selected rep',
    rows: [
      ['Shift + I / O', 'Snap In / Out to playhead'],
      [', / .', 'Nudge start ∓1 frame'],
      ['; / \'', 'Nudge end ∓1 frame'],
      ['Tab / Shift+Tab', 'Select next / previous rep'],
      ['Del', 'Delete selected rep'],
    ],
  },
  {
    title: 'Pose review (with skeleton)',
    rows: [
      ['Q / W / E', 'Toggle: tracking error / occlusion / drift'],
      ['R / T / Y', 'Toggle: non-human / out-of-frame / wrong-person'],
      ['Ctrl/Cmd + S', 'Save the current frame’s pose flag'],
    ],
  },
  {
    title: 'Timeline',
    rows: [
      ['[ / ]', 'Zoom out / in'],
      ['Shift + Z', 'Fit to window'],
      ['Cmd/Ctrl + scroll', 'Zoom at cursor'],
      ['S', 'Toggle snapping (Alt = bypass)'],
      ['Drag segment edge', 'Adjust rep start / end'],
    ],
  },
];

export default function ShortcutsOverlay() {
  const show = useStore((s) => s.showShortcuts);
  const toggle = useStore((s) => s.toggleShortcuts);
  const closeRef = useRef<HTMLButtonElement>(null);

  // move focus into the dialog when it opens; restore it when it closes
  useEffect(() => {
    if (!show) return;
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    return () => prev?.focus?.();
  }, [show]);

  if (!show) return null;
  return (
    <div className="shortcuts-overlay" onClick={toggle}>
      <div
        className="shortcuts-card"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shortcuts-head">
          <h2>Keyboard shortcuts</h2>
          <button ref={closeRef} onClick={toggle} aria-label="Close shortcuts" title="Close (Esc)"><X size={18} /></button>
        </div>
        <div className="shortcuts-grid">
          {SECTIONS.map((sec) => (
            <div key={sec.title} className="shortcuts-section">
              <h3>{sec.title}</h3>
              {sec.rows.map(([k, d]) => (
                <div key={k} className="shortcut-row">
                  <span className="shortcut-keys"><kbd>{k}</kbd></span>
                  <span className="shortcut-desc">{d}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
