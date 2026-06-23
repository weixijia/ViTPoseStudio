# Rep Annotator

A frame-accurate, **fully-local** web tool for annotating fitness coaching videos to produce
**rep-counting ground truth** for machine-learning training.

Load a video, scrub it frame-by-frame like Final Cut / 剪映, mark the start and end frame of
each movement cycle (a *rep*), tag it with an action type, optionally add notes, and export
**one CSV row per rep**.

- **Frame-accurate.** A plain HTML `<video>` element only does *best-effort* seeking, so the
  paused frame may not be the frame you think it is — unacceptable for rep-counting labels.
  This tool decodes frames with [Mediabunny](https://mediabunny.dev/) (demux) + the browser
  **WebCodecs API**, addressing every frame by an exact integer index built from the file's
  packet timestamps. The frame numbers written to the CSV are exact.
- **100% local.** Your video never leaves the machine — no upload, no backend, no server.
- **Editor-grade timeline.** A clean clip track, adaptive ruler (frames↔seconds↔minutes),
  draggable playhead, zoom, and draggable rep boundaries with snapping.
- **Synced audio.** Plays the file's audio track in sync with the video (audio is the
  playback clock); mute toggle in the transport bar.
- **Pose-quality review.** Optionally pre-extract a MediaPipe skeleton and review it
  frame-by-frame in a split **RGB | skeleton** view — flag frames with bad tracking
  (occlusion, drift, etc.) plus a free-text note. Exports a second CSV.

---

## Requirements

- **Node.js 18+** and npm (for development / building).
- A **Chromium-based browser — Chrome or Edge (latest).** WebCodecs is required. The app shows
  a clear notice in browsers that lack it.
- See **[Video formats & HEVC](#video-formats--hevc)** below — your video must be in a codec
  your browser can hardware-decode. H.264 (AVC) MP4 works everywhere; HEVC/H.265 is
  platform-dependent.

---

## Quick start

```bash
cd video_annotation_toolkit
npm install
npm run dev        # opens http://localhost:5180
```

Then drag a video file onto the page (or click **Choose video file**). A sample is at
`videos/instructor1.m4v`.

To build a static bundle you can host anywhere (or open via any static file server):

```bash
npm run build      # outputs to dist/
npm run preview    # serve the production build locally
```

---

## 🤖 AI setup prompt

Don't want to set it up by hand? Paste the prompt below to an AI coding assistant
(Claude Code, Cursor, Copilot Chat, etc.) **from inside the `video_annotation_toolkit`
directory**. It will install everything, transcode incompatible videos, and start the app.

````text
You are setting up and running a local web app called "Rep Annotator" located in the current
directory (video_annotation_toolkit). It is a Vite + React + TypeScript app that uses the
browser WebCodecs API (via the "mediabunny" package) for frame-accurate video annotation. It is
fully client-side — there is NO backend to configure. Do the following, detecting my OS
(Windows / macOS / Ubuntu-Linux) and using the right commands:

1. Verify Node.js >= 18 and npm are installed (`node -v`, `npm -v`). If Node is missing or older
   than 18, install it:
   - macOS: `brew install node`  (or nvm)
   - Ubuntu/Debian: install via nvm, or `sudo apt-get install -y nodejs npm` (prefer nvm for v18+)
   - Windows: `winget install OpenJS.NodeJS.LTS`  (or download the LTS installer)

2. In this directory, run `npm install`.

3. Check my video files. This tool needs a codec the browser can decode via WebCodecs.
   - H.264 (AVC) MP4 works on every OS/browser.
   - HEVC/H.265 (common in .m4v / iPhone footage) only decodes where the browser has HEVC
     hardware support: fine on macOS, usually fine on Windows Edge, but OFTEN FAILS on Ubuntu/Linux Chrome.
   If `ffmpeg` is available, probe each video in ./videos with
   `ffmpeg -i <file>` (read the codec from stderr) or `ffprobe -v error -select_streams v:0
   -show_entries stream=codec_name -of csv=p=0 <file>`. For any video whose codec is hevc/h265
   — AND I'm on Linux, or just to be safe for cross-machine use — transcode it to H.264:
   `ffmpeg -i "<input>" -c:v libx264 -crf 18 -preset slow -c:a aac "<input-basename>_h264.mp4"`
   If ffmpeg is not installed, tell me how to install it (brew/apt/winget) and ask whether to proceed.

4. (Optional — pose-quality review) If I want the MediaPipe skeleton view, in a Python 3.9–3.12
   environment run `pip install -r tools/requirements.txt` then `python tools/extract_mediapipe.py`
   to pre-extract skeletons for the videos in `./videos` (writes `./mediapipe_skeleton/`). Skip this
   if I only need rep counting.

5. Start the dev server: `npm run dev`. It serves http://localhost:5180 and tries to open a browser.
   Tell me to open it in **Chrome or Edge** (not Safari/Firefox).

6. Verify it works: confirm the page loads with a "Drop a video to start" screen and no console
   errors. If I report that a video won't load / shows a "cannot be decoded" message, it's the
   HEVC issue from step 3 — transcode that file to H.264 and retry.

Report each step's result. Do not add a backend, Docker, or cloud services — this app is
intentionally local-only.
````

---

## Workflow

1. **Load a video.**
2. Pick the **action type** (a configurable dropdown — or click **＋** to add a custom one).
3. Navigate to the **first frame** of a rep → **Mark In** (`I`).
4. Navigate to the **last frame** of the rep → **Mark Out** (`O`).
5. (Optional) Type **notes** for this rep.
6. **Add Rep** (`Enter`). It appears as a colored segment on the timeline and a row in the Reps table.
7. Repeat for every rep. Adjust boundaries any time by dragging a segment's edge on the timeline.
8. **Export CSV**, or **Save Project** (JSON) to resume later.

---

## Keyboard shortcuts

Press **`?`** in the app for the full overlay.

| Key | Action | Key | Action |
| --- | --- | --- | --- |
| `Space` | Play / Pause | `I` / `O` | Mark In / Out |
| `←` / `→` | Step ∓1 frame | `Enter` | Add rep |
| `Shift`+`←`/`→` | Step ∓10 frames | `Esc` | Clear In/Out |
| `J` / `K` / `L` | Shuttle reverse / stop / forward | `Del` | Delete selected rep |
| `Home` / `End` | First / last frame | `1`–`9` | Select action by hotkey |
| `[` / `]` | Zoom timeline out / in | `Shift`+`Z` | Fit timeline to window |
| `Cmd/Ctrl`+scroll | Zoom at cursor | `S` | Toggle snapping (`Alt` = bypass) |
| `Shift`+`I` / `O` | Snap selected rep's In/Out to playhead | `Tab` / `Shift`+`Tab` | Select next / previous rep |
| `,` / `.` | Nudge selected rep **start** ∓1 frame | `;` / `'` | Nudge selected rep **end** ∓1 frame |

---

## The timeline

A custom editor-style timeline (think 剪映 / Final Cut):

- **Clip track** — a clean media band representing the video, with subtle gridlines (no thumbnails).
- **Adaptive ruler** — tick spacing/labels switch between frames, seconds, and minutes as you zoom.
- **Playhead** — drag the handle (or click/drag the ruler) to scrub; it auto-follows during playback.
- **Zoom** — toolbar `－ / slider / ＋ / ⤢ Fit`, `[`/`]`, or `Cmd/Ctrl`+scroll. Opens at a fine,
  seconds-level zoom; **⤢ Fit** (`Shift+Z`) shows the whole clip.
- **Rep segments** — each rep is a labeled colored bar. **Drag its left/right edge** to adjust the
  start/end frame, or drag the body to move it. Boundaries **snap** to the playhead, other reps, and t=0
  (toggle with `S`, hold `Alt` to bypass).

---

## Action types

The dropdown list lives in **`src/config/actions.config.ts`** — replace the placeholder entries with
your real movement set:

```ts
export const ACTION_TYPES: ActionTypeDef[] = [
  { id: 'squat',  label: 'Squat',    hotkey: '1' },
  { id: 'pushup', label: 'Push-up',  hotkey: '2' },
  // …
];
```

- `id` is the value written to the CSV (`action_type`) — keep it stable; it becomes an ML label.
- `label` is shown in the UI. `hotkey` is an optional `1`–`9` quick-select.

**Custom actions, per video.** Click **＋** next to the dropdown to add an action on the fly. It
immediately becomes selectable, and is **saved for that video by filename** (in `localStorage`) so it
reappears when you reload the same file. You can also **⬇ Actions** / **📂 Actions** to export/import a
portable `<videoname>_actions.json` (e.g. to share a label set with other annotators).

---

## Pose-quality review (MediaPipe)

A second annotation dimension: flag frames where the pose tracker is wrong. Because annotators may
not have MediaPipe installed, skeletons are **pre-extracted** once, up front.

### 1. Pre-extract skeletons (one-time, per video)

Put videos in `videos/`, then run (Python 3.9–3.12):

```bash
pip install -r tools/requirements.txt          # mediapipe + opencv (one time)
python tools/extract_mediapipe.py              # processes every video in ./videos
# python tools/extract_mediapipe.py --model-complexity 0   # faster, lower accuracy
```

This writes a frame-aligned `mediapipe_skeleton/<video>.json` per video plus a `manifest.json`.
Both `videos/` and `mediapipe_skeleton/` are git-ignored.

### 2. Annotate

Run `npm run dev`. The start screen lists **pre-processed videos** — pick one and it auto-loads the
RGB video **and** its skeleton (the video streams via HTTP range requests, no upload). The stage
splits in two: **left = RGB**, **right = MediaPipe skeleton** drawn over a dimmed copy of the frame
(toggle the backdrop with **RGB on/off**).

In the **Pose Review** panel, for the current frame toggle one or more error labels
(`Q W E R T Y`) and/or type an `error_note`. Flagged frames get a red border on the skeleton panel
and appear in a jump-list. It's per-frame — most frames need nothing. Edit the label set in
`src/config/poseErrors.config.ts`.

---

## Output CSV

**Reps** — one row per rep (`⬇ Reps`):

```
video_filename, video_fps, action_type, rep_index,
start_frame, end_frame, n_frames, start_time_sec, end_time_sec, duration_sec, annotator, notes
```

- `rep_index` is per `action_type`, numbered by start-frame order with no gaps (deleting rep #2 of an
  action renumbers the rest to 1, 2, …).
- `start_frame`/`end_frame` are exact integer frame indices; the `*_time_sec` columns are the exact
  presentation timestamps of those frames.
- `n_frames` = inclusive frame count (`end_frame − start_frame + 1`, matches the UI); `duration_sec` =
  elapsed time between the two boundary frames (`end_time_sec − start_time_sec`).

**Pose errors** — one row per flagged frame (`⬇ Pose`, only when a skeleton is loaded):

```
video_filename, frame, time_sec, labels, error_note
```

- `labels` is a `;`-separated list of the toggled error labels for that frame.

Change the schemas in **`src/utils/csv.ts`** if you need different columns.

---

## Save / resume a project

**💾 Save** downloads `<videoname>_project.json` containing all reps, the annotator name, and custom
actions. **📂 Load** restores them (load the same video first, then the project). Use this to pause and
resume long annotation sessions.

---

## Video formats & HEVC

Chrome **has no built-in software HEVC decoder** — HEVC/H.265 only decodes where the machine has a
hardware HEVC decoder:

| Platform | H.264 (AVC) | HEVC / H.265 |
| --- | --- | --- |
| macOS (Chrome/Edge) | ✅ | ✅ (VideoToolbox) |
| Windows (Edge / Chrome) | ✅ | ⚠️ usually OK (may need GPU + "HEVC Video Extensions") |
| Ubuntu / Linux (Chrome) | ✅ | ❌ often unavailable in stock Chrome |

The app detects this via `canDecode()` and shows a clear message if a video can't be decoded.

**For cross-machine / cross-OS use, transcode to H.264 once** — it decodes everywhere:

```bash
ffmpeg -i input.m4v -c:v libx264 -crf 18 -preset slow -c:a aac input_h264.mp4
```

(Visually lossless at `-crf 18`; frame-by-frame annotation is unaffected.)

---

## Project structure

```
video_annotation_toolkit/
  src/
    engine/        VideoEngine + frame index (Mediabunny + WebCodecs), PlayLoop (smooth playback)
    state/         zustand store (reps, playback, zoom, custom actions)
    hooks/         playback loop, keyboard shortcuts
    components/    VideoCanvas, TransportControls, Timeline, AnnotationPanel, RepTable,
                   ExportBar, ShortcutsOverlay
    config/        actions.config.ts  ← edit your action taxonomy here
    utils/         csv, time, ruler, actionStore (custom-action persistence)
  videos/          put source videos here (sample: instructor1.m4v)
```

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Browser not supported" full-screen notice | Open in Chrome or Edge (WebCodecs required). |
| "This video cannot be decoded…" | Codec not hardware-decodable on this machine (usually HEVC on Linux). Transcode to H.264 (above). |
| Video loads but won't play | Make sure you're on the latest Chrome/Edge; check the browser console. |
| Thumbnails say "generating…" for a while | Long clips take a moment to sample; annotation still works meanwhile. |
| Custom action disappeared | It's stored per video filename in `localStorage`; clearing site data or renaming the file resets it. Use **⬇ Actions** to keep a portable copy. |

---

## How it works (in one paragraph)

On load, Mediabunny demuxes the file and we walk the encoded packets (no decoding) to build an exact
`frame → presentation-timestamp` table. Seeking/stepping addresses frames by integer index and decodes
exactly that frame via a WebCodecs-backed `CanvasSink`. During playback the file's audio plays natively
through a hidden `<audio>` element and acts as the master clock; Mediabunny's sequential canvas iterator
decodes video frames in order and paces them to that audio clock (falling back to a wall clock if audio
can't play), while paused frames stay exact. The timeline is a windowed canvas; the playhead and rep
segments map between frame indices and pixels through the same timestamp table, so every annotation is
frame-accurate.
