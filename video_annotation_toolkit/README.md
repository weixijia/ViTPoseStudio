# Rep Annotator

A frame-accurate, **fully-local** web tool for annotating fitness coaching videos to produce
**rep-counting ground truth** for machine-learning training.

Load a video, scrub it frame-by-frame like Final Cut / 剪映, mark the start and end frame of
each movement cycle (a *rep*), tag it with an action type, optionally add notes. Everything
**auto-saves to disk** as JSON — one record per rep, plus per-frame pose-quality flags.

- **Frame-accurate.** A plain HTML `<video>` element only does *best-effort* seeking, so the
  paused frame may not be the frame you think it is — unacceptable for rep-counting labels.
  This tool decodes frames with [Mediabunny](https://mediabunny.dev/) (demux) + the browser
  **WebCodecs API**, addressing every frame by an exact integer index built from the file's
  packet timestamps. The frame numbers written to disk are exact.
- **100% local.** Your video never leaves the machine — no upload, no cloud.
- **Editor-grade timeline.** A clean clip track, adaptive ruler (frames↔seconds↔minutes),
  draggable playhead, zoom, and draggable rep boundaries with snapping.
- **Synced audio.** Plays the file's audio track in sync with the video (audio is the
  playback clock); mute toggle in the transport bar.
- **Pose-quality review.** Optionally pre-extract a MediaPipe skeleton and review it
  frame-by-frame in a split **RGB | skeleton** view — flag frames with bad tracking
  (occlusion, drift, etc.) plus a free-text note, auto-saved to a second JSON.

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

Then drag a video file onto the page (or click **Choose video file**), or drop videos into the
`videos/` folder and pick them from the welcome-page library. (`videos/instructor1.m4v` is an
example path — add your own clips.)

**For the MediaPipe pose view + in-app pre-processing** (optional — not needed for rep counting),
run the one-time setup, which creates a self-contained Python environment in `tools/.venv`:

```bash
npm run setup      # builds tools/.venv and installs MediaPipe + OpenCV
npm run dev        # the welcome page can now pre-process videos (auto-detects tools/.venv)
```

Requires Python 3.9–3.12 on the machine (`python3`/`python`). Nothing is hardcoded — any teammate
who clones the repo runs the same two commands. No `MEDIAPIPE_PYTHON`, no absolute paths.

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

4. (Optional — pose-quality review) If I want the MediaPipe skeleton view, run `npm run setup`. It
   creates a self-contained Python environment in `tools/.venv` and installs MediaPipe + OpenCV
   (needs Python 3.9–3.12 on the machine). The dev server then auto-detects it — I can pre-process
   videos from the welcome-page library, or run `python tools/extract_mediapipe.py` directly. Skip
   this if I only need rep counting.

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
8. Nothing to save manually — your work auto-saves to `annotation/<video>/` as you go. Reopen the same video to resume.

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

## Action types (per-video label files)

The action dropdown is driven by a **per-video JSON file you edit by hand** — not the GUI. For a video
`coach.mp4`, the app loads `action_labels/coach.json` (matched by name) on open:

```json
{
  "actions": [
    { "id": "squat",  "label": "Squat",   "hotkey": "1" },
    { "id": "pushup", "label": "Push-up", "hotkey": "2" }
  ]
}
```

- `id` is the value written to the CSV (`action_type`) — keep it stable; it becomes an ML label.
- `label` shows in the dropdown; `hotkey` is an optional `1`–`9` quick-select.
- Edit the file and reload the video to change the label set. See `action_labels/_example.json`.
- The preprocessing script (`tools/extract_mediapipe.py`) scaffolds a starter `action_labels/<name>.json`
  for each video (only if absent), so you have a file to edit.
- If a video has **no** `action_labels` file, the built-in defaults in `src/config/actions.config.ts`
  are used as a fallback.

So the three inputs all match by file name: `videos/<name>`, `mediapipe_skeleton/<base>.json`, and
`action_labels/<base>.json`.

---

## Pose-quality review (MediaPipe)

A second annotation dimension: flag frames where the pose tracker is wrong. Because annotators may
not have MediaPipe installed, skeletons are **pre-extracted** once, up front.

### 1. Set up MediaPipe (one-time, per machine)

```bash
npm run setup      # creates tools/.venv and installs MediaPipe + OpenCV (Python 3.9–3.12)
```

This builds a self-contained environment in `tools/.venv`. The dev server **auto-detects** it — in
discovery order: `MEDIAPIPE_PYTHON` (if you set it) → `tools/.venv` → `.venv` → system `python3`/
`python`. So a teammate who clones the repo just runs `npm run setup` once; nothing is hardcoded.
(`MEDIAPIPE_PYTHON=/path/to/python` remains available as an override if MediaPipe lives elsewhere,
e.g. an existing conda env.)

### 2. Extract skeletons (per video)

Put videos in `videos/`, then extract **from the welcome page** or the command line.

**From the app (recommended).** Run `npm run dev`. The welcome page's **video library** lists every
file in `videos/` with its status — skeleton ✓/–, action labels ✓/–, and annotation progress. Drop in
new clips and click **Pre-process N new** to run MediaPipe on the ones missing a skeleton: they're
processed **one at a time**, each with a live progress bar. If MediaPipe isn't set up, a banner tells
you to run `npm run setup` (and the button is disabled until it is).

**From the command line:**

```bash
# uses tools/.venv automatically; or activate it first / use any Python with mediapipe
tools/.venv/bin/python tools/extract_mediapipe.py        # macOS/Linux  (Windows: tools\.venv\Scripts\python.exe)
# add --model-complexity 0 for faster, lower-accuracy extraction
```

Either way you get a frame-aligned `mediapipe_skeleton/<video>.json` per video (storing **x, y, z and
the per-keypoint visibility/confidence**) plus a `manifest.json`. Both `videos/` and
`mediapipe_skeleton/` are git-ignored.

### 3. Annotate

Run `npm run dev`. The welcome page's **video library** lists every video — pick one and it auto-loads the
RGB video **and** its skeleton (the video streams via HTTP range requests, no upload). The stage
splits in two: **left = RGB**, **right = MediaPipe skeleton** drawn over a dimmed copy of the frame
(toggle the backdrop with **RGB on/off**). Under the skeleton, a quiet **per-keypoint confidence
meter** shows each landmark's visibility as a bar — high-confidence bars stay dim so they don't
compete with the pose, while low-confidence ones glow amber/red to flag where tracking is unreliable
(hover a bar for the keypoint name + score).

In the **Pose Review** panel, for the current frame toggle one or more error labels
(`Q W E R T Y`) and/or type an `error_note`. Flagged frames get a red border on the skeleton panel
and appear in a jump-list. It's per-frame — most frames need nothing. Edit the label set in
`src/config/poseErrors.config.ts`.

---

## Output (auto-saved, no downloads)

Every change is written to disk automatically — there are no download dialogs. For a video
`coach.mp4` two JSON files are kept under `annotation/coach/`:

**`annotation/<video>/rep_counting.json`** — the reps:

```jsonc
{
  "video": "coach.mp4", "fps": 29.97, "frame_count": 79595, "annotator": "...",
  "reps": [
    { "action_type": "squat", "rep_index": 1, "start_frame": 120, "end_frame": 168,
      "n_frames": 49, "start_time_sec": 4.004, "end_time_sec": 5.605,
      "duration_sec": 1.601, "notes": "" }
  ],
  "saved_at": "..."
}
```

**`annotation/<video>/pose_analysis.json`** — one entry per flagged frame:

```jsonc
{
  "video": "coach.mp4", "fps": 29.97, "frame_count": 79595,
  "pose_errors": [ { "frame": 553, "time_sec": 18.45, "labels": ["occlusion"], "note": "legs cut off" } ],
  "saved_at": "..."
}
```

- `rep_index` is per `action_type`, renumbered by start-frame order (no gaps after a delete).
- Frames are exact integer indices; `*_time_sec` are exact presentation timestamps.
- The header shows the live save state (**Saved** / **Saving…** / **Save failed**).
- **Resume is automatic**: reopen the same video and its saved reps + pose flags load back.

> Auto-save uses a small dev-server endpoint, so it works while running **`npm run dev`** (how the tool
> is used). Files land under `video_annotation_toolkit/annotation/` (git-ignored). Build the JSON-shaping
> in `src/utils/autosave.ts` if you need a different schema.

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
    engine/        VideoEngine + frame index, PlayLoop, AudioPlayer, skeleton (Mediabunny + WebCodecs)
    state/         zustand store (reps, pose errors, playback, zoom, action types)
    hooks/         playback loop, keyboard shortcuts, autosave
    components/    VideoCanvas, SkeletonCanvas, TransportControls, Timeline, AnnotationPanel,
                   PoseErrorPanel, RepTable, SaveStatus, Tutorial, ShortcutsOverlay
    config/        actions.config.ts (default labels), poseErrors.config.ts
    utils/         autosave (writes annotation JSON), time, ruler, actionStore, csv helpers
  videos/             put source videos here (sample: instructor1.m4v)        [git-ignored]
  annotation/         auto-saved output: <video>/rep_counting.json + pose_analysis.json [git-ignored]
  mediapipe_skeleton/ pre-extracted skeletons + manifest.json                 [git-ignored]
  action_labels/      per-video label files <name>.json (edit by hand)        [git-ignored]
  tools/              extract_mediapipe.py preprocessing
```

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| "Browser not supported" full-screen notice | Open in Chrome or Edge (WebCodecs required). |
| "This video cannot be decoded…" | Codec not hardware-decodable on this machine (usually HEVC on Linux). Transcode to H.264 (above). |
| Video loads but won't play | Make sure you're on the latest Chrome/Edge; check the browser console. |
| Dropdown shows default actions, not mine | Add/edit `action_labels/<video-basename>.json` and reload the video. |
| Skeleton looks misaligned (warning banner) | Skeleton frame count ≠ video; re-run `extract_mediapipe.py`, ideally on a CFR re-encode. |
| "Pose pre-processing isn't set up" banner / Pre-process button disabled | Run `npm run setup` (creates `tools/.venv` with MediaPipe), then restart `npm run dev`. Needs Python 3.9–3.12. |
| `npm run setup` fails on `venv` | On Debian/Ubuntu install `python3-venv` (`sudo apt install python3-venv`); ensure `python3 --version` is 3.9–3.12 (not 3.13+). |
| A preprocess row turns red ("failed") | Hover it for the error. Usually MediaPipe missing in the detected Python — run `npm run setup`, or set `MEDIAPIPE_PYTHON` to a Python that has it. |

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
