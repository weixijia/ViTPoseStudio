#!/usr/bin/env python3
"""
Pre-extract MediaPipe Pose skeletons for the Rep Annotator web tool.

For each video in ./videos, runs MediaPipe Pose frame-by-frame and writes a
frame-aligned skeleton file to ./mediapipe_skeleton/<basename>.json, plus a
manifest.json the web app reads to auto-load the RGB video + skeleton together.

This runs BEFORE the browser tool, so annotators don't need MediaPipe installed.

Usage:
    python tools/extract_mediapipe.py                 # process every video in ./videos
    python tools/extract_mediapipe.py videos/foo.m4v  # one file
    python tools/extract_mediapipe.py --force         # re-extract even if output exists
    python tools/extract_mediapipe.py --max-frames 200  # quick test on first N frames

Output JSON schema (per video):
    {
      "video": "foo.m4v", "width": W, "height": H, "fps": F, "frame_count": N,
      "model": "mediapipe_pose", "num_landmarks": 33,
      "frames": [ [x0,y0,v0, x1,y1,v1, ... 33 landmarks] | null, ... ]   # x,y normalized [0,1]
    }
"""
import argparse
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # the video_annotation_toolkit dir
VIDEOS_DIR = os.path.join(ROOT, "videos")
OUT_DIR = os.path.join(ROOT, "mediapipe_skeleton")

VIDEO_EXTS = {".mp4", ".m4v", ".mov", ".avi", ".webm", ".mkv"}


def find_videos(args_paths):
    if args_paths:
        return [os.path.abspath(p) for p in args_paths]
    if not os.path.isdir(VIDEOS_DIR):
        return []
    return sorted(
        os.path.join(VIDEOS_DIR, f)
        for f in os.listdir(VIDEOS_DIR)
        if os.path.splitext(f)[1].lower() in VIDEO_EXTS
    )


def extract_one(video_path, pose, max_frames=None, progress_every=200):
    import cv2

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Could not open {video_path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    declared = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    frames = []
    detected = 0
    idx = 0
    t0 = time.time()
    while True:
        ok, frame_bgr = cap.read()
        if not ok:
            break
        rgb = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        res = pose.process(rgb)
        if res.pose_landmarks:
            flat = []
            for lm in res.pose_landmarks.landmark:
                flat.append(round(float(lm.x), 4))
                flat.append(round(float(lm.y), 4))
                flat.append(round(float(lm.visibility), 3))
            frames.append(flat)
            detected += 1
        else:
            frames.append(None)
        idx += 1
        if progress_every and idx % progress_every == 0:
            rate = idx / max(1e-6, time.time() - t0)
            print(f"    {idx} frames ({rate:.1f} fps)…", flush=True)
        if max_frames and idx >= max_frames:
            break
    cap.release()
    # The web app indexes frames in presentation order (sorted packet timestamps); OpenCV
    # reads them in the same order for constant-frame-rate video, so frame i here == frame i
    # there. A big mismatch vs the container's declared count signals a truncated/VFR file
    # whose skeleton may misalign — warn so it can be re-encoded to CFR.
    if not max_frames and declared and abs(declared - len(frames)) > 1:
        print(f"    WARNING: read {len(frames)} frames but container declares {declared} "
              f"(truncated or variable-frame-rate?) — skeleton may misalign; consider re-encoding to CFR.",
              flush=True)
    return {
        "width": width,
        "height": height,
        "fps": round(fps, 6),
        "frame_count": len(frames),
        "detected_frames": detected,
        "model": "mediapipe_pose",
        "num_landmarks": 33,
        "frames": frames,
    }


def main():
    ap = argparse.ArgumentParser(description="Extract MediaPipe Pose skeletons for the Rep Annotator.")
    ap.add_argument("paths", nargs="*", help="Specific video file(s); default: all in ./videos")
    ap.add_argument("--force", action="store_true", help="Re-extract even if output JSON exists")
    ap.add_argument("--max-frames", type=int, default=None, help="Only process the first N frames (testing)")
    ap.add_argument("--model-complexity", type=int, default=1, choices=[0, 1, 2],
                    help="MediaPipe model_complexity (0=fastest, 2=most accurate)")
    args = ap.parse_args()

    try:
        import mediapipe as mp
    except ImportError:
        sys.exit("ERROR: mediapipe is not installed. Run: pip install mediapipe opencv-python")

    videos = find_videos(args.paths)
    if not videos:
        sys.exit(f"No videos found. Put videos in {VIDEOS_DIR} or pass paths explicitly.")

    os.makedirs(OUT_DIR, exist_ok=True)
    manifest_path = os.path.join(OUT_DIR, "manifest.json")
    manifest = {}
    if os.path.exists(manifest_path):
        try:
            with open(manifest_path) as f:
                manifest = {e["video"]: e for e in json.load(f).get("videos", [])}
        except Exception:
            manifest = {}

    mp_pose = mp.solutions.pose
    for video_path in videos:
        name = os.path.basename(video_path)
        base = os.path.splitext(name)[0]
        out_path = os.path.join(OUT_DIR, base + ".json")
        if os.path.exists(out_path) and not args.force and not args.max_frames:
            print(f"• {name}: skeleton exists, skipping (use --force to redo)")
            manifest.setdefault(name, {"video": name, "skeleton": base + ".json"})
            continue

        print(f"• {name}: extracting MediaPipe pose…", flush=True)
        with mp_pose.Pose(
            static_image_mode=False,
            model_complexity=args.model_complexity,
            enable_segmentation=False,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as pose:
            data = extract_one(video_path, pose, max_frames=args.max_frames)
        data["video"] = name

        with open(out_path, "w") as f:
            json.dump(data, f, separators=(",", ":"))
        size_mb = os.path.getsize(out_path) / 1e6
        print(f"  ✓ {out_path}  ({data['frame_count']} frames, "
              f"{data['detected_frames']} with pose, {size_mb:.1f} MB)")

        manifest[name] = {
            "video": name,
            "skeleton": base + ".json",
            "frame_count": data["frame_count"],
            "fps": data["fps"],
            "width": data["width"],
            "height": data["height"],
        }

    with open(manifest_path, "w") as f:
        json.dump({"videos": list(manifest.values())}, f, indent=2)
    print(f"\nManifest: {manifest_path} ({len(manifest)} video(s))")
    print("Now run `npm run dev` and the tool will offer these videos for annotation.")


if __name__ == "__main__":
    main()
