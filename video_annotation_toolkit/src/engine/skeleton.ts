/**
 * Loads and serves the pre-extracted MediaPipe Pose skeleton for the loaded video
 * (produced by tools/extract_mediapipe.py). Frame-aligned to the video's frame index.
 */

export interface SkeletonData {
  video: string;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  numLandmarks: number;
  /** Values per landmark: 3 (x,y,visibility) for older files, 4 (x,y,z,visibility) for newer. */
  stride: number;
  /** Per frame: Float32Array of [x,y,(z,)vis] × numLandmarks (x,y normalized 0..1), or null. */
  frames: (Float32Array | null)[];
}

/** MediaPipe Pose 33-landmark names (index → name), for the confidence-bar hover readout. */
export const LANDMARK_NAMES: readonly string[] = [
  'nose', 'left eye (inner)', 'left eye', 'left eye (outer)', 'right eye (inner)', 'right eye',
  'right eye (outer)', 'left ear', 'right ear', 'mouth (left)', 'mouth (right)',
  'left shoulder', 'right shoulder', 'left elbow', 'right elbow', 'left wrist', 'right wrist',
  'left pinky', 'right pinky', 'left index', 'right index', 'left thumb', 'right thumb',
  'left hip', 'right hip', 'left knee', 'right knee', 'left ankle', 'right ankle',
  'left heel', 'right heel', 'left foot index', 'right foot index',
];

/** MediaPipe Pose (33-landmark) connections — full set incl. face, so bad/garbage poses are obvious. */
export const POSE_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  // face
  [0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10],
  // arms
  [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19],
  [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20],
  // torso
  [11, 23], [12, 24], [23, 24],
  // legs
  [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32],
];

class SkeletonStore {
  data: SkeletonData | null = null;

  /** Fetch + parse a skeleton JSON. Returns null on failure (skeleton is optional). */
  async loadFromUrl(url: string): Promise<SkeletonData | null> {
    this.data = null;
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const raw = await res.json();
      const rawFrames: (number[] | null)[] = raw.frames ?? [];
      const frames: (Float32Array | null)[] = rawFrames.map((f) => (f ? Float32Array.from(f) : null));
      const numLandmarks = raw.num_landmarks ?? 33;
      // stride = values per landmark; from the file, or inferred from the first detected frame
      let stride: number = raw.values_per_landmark ?? 0;
      if (!stride) {
        const first = frames.find((f) => f);
        stride = first && numLandmarks ? Math.round(first.length / numLandmarks) : 3;
      }
      this.data = {
        video: raw.video ?? '',
        width: raw.width ?? 0,
        height: raw.height ?? 0,
        fps: raw.fps ?? 0,
        frameCount: raw.frame_count ?? frames.length,
        numLandmarks,
        stride: stride || 3,
        frames,
      };
      return this.data;
    } catch {
      this.data = null;
      return null;
    }
  }

  clear() {
    this.data = null;
  }

  get available(): boolean {
    return !!this.data;
  }

  /** Landmarks [x,y,vis…] for a frame index, or null. */
  frame(index: number): Float32Array | null {
    const d = this.data;
    if (!d) return null;
    if (index < 0 || index >= d.frames.length) return null;
    return d.frames[index];
  }
}

export const skeleton = new SkeletonStore();
