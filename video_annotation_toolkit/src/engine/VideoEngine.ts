import {
  Input,
  ALL_FORMATS,
  BlobSource,
  CanvasSink,
} from 'mediabunny';
import { buildFrameIndex } from './frameIndex';
import type { VideoMeta } from '../types';
import { clamp } from '../utils/time';

export interface ThumbStrip {
  sheet: HTMLCanvasElement;
  times: number[]; // timestamp (s) of each thumbnail, left→right
  thumbW: number;
  thumbH: number;
}

/**
 * Frame-accurate video engine built on Mediabunny (demux) + WebCodecs (decode).
 *
 * Unlike a plain HTML <video> element — whose seeking is "best effort" and may
 * land on the wrong frame — this engine addresses frames by integer index via a
 * precomputed timestamp table, then decodes exactly that frame. That guarantees
 * the frame numbers written into the rep-counting ground truth are correct.
 */
export class VideoEngine {
  private sink: CanvasSink | null = null;
  private input: Input | null = null;

  /** The loaded File (the PlayLoop builds its own decoder Input from it). */
  file: File | null = null;
  /** The display canvas the PlayLoop blits onto during playback (registered by VideoCanvas). */
  displayCanvas: HTMLCanvasElement | null = null;

  /** Exact presentation timestamp (seconds) for each frame index, in display order. */
  timestamps: number[] = [];
  meta: VideoMeta | null = null;

  /** Load a file: demux, build the frame index, prepare the decode sink. */
  async load(file: File): Promise<VideoMeta> {
    this.dispose();

    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    const track = await input.getPrimaryVideoTrack();
    if (!track) {
      throw new Error('No video track found in this file.');
    }
    if (!(await track.canDecode())) {
      throw new Error(
        'This video cannot be decoded in your browser. Try Chrome/Edge, or re-encode to H.264 MP4.',
      );
    }

    const { timestamps, fps } = await buildFrameIndex(track);
    if (timestamps.length === 0) {
      throw new Error('Video track contains no frames.');
    }

    const duration = await track.computeDuration();
    const sink = new CanvasSink(track, { poolSize: 2 });

    this.input = input;
    this.sink = sink;
    this.file = file;
    this.timestamps = timestamps;
    this.meta = {
      name: file.name,
      width: track.displayWidth,
      height: track.displayHeight,
      durationSec: duration,
      fps,
      frameCount: timestamps.length,
    };
    return this.meta;
  }

  get frameCount(): number {
    return this.timestamps.length;
  }

  /** Exact presentation time (seconds) of a frame index. */
  timeOfFrame(frame: number): number {
    if (this.timestamps.length === 0) return 0;
    return this.timestamps[clamp(Math.round(frame), 0, this.timestamps.length - 1)];
  }

  /** Nearest frame index for a given time (seconds) — used by timeline seeking. */
  frameAtTime(sec: number): number {
    const ts = this.timestamps;
    if (ts.length === 0) return 0;
    // binary search for the last timestamp <= sec
    let lo = 0;
    let hi = ts.length - 1;
    if (sec <= ts[0]) return 0;
    if (sec >= ts[hi]) return hi;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ts[mid] <= sec) lo = mid;
      else hi = mid - 1;
    }
    // pick whichever of lo / lo+1 is closer
    if (lo + 1 < ts.length && Math.abs(ts[lo + 1] - sec) < Math.abs(ts[lo] - sec)) {
      return lo + 1;
    }
    return lo;
  }

  /**
   * Decode and return the canvas for an exact frame index. The returned canvas is
   * owned by the sink's pool — draw from it immediately, do not retain it.
   */
  async getFrameCanvas(frame: number): Promise<HTMLCanvasElement | OffscreenCanvas | null> {
    if (!this.sink) return null;
    const idx = clamp(Math.round(frame), 0, this.frameCount - 1);
    const result = await this.sink.getCanvas(this.timestamps[idx]);
    return result ? result.canvas : null;
  }

  /**
   * Generate a horizontal thumbnail sprite-sheet at `count` evenly-spaced times.
   * Uses a dedicated small-width CanvasSink for speed. Decorative — callers should
   * tolerate failure gracefully.
   */
  async generateThumbStrip(count: number): Promise<ThumbStrip | null> {
    if (!this.file || !this.meta) return null;
    const n = clamp(Math.round(count), 4, 40);
    const thumbW = 96;
    const thumbH = Math.max(1, Math.round(thumbW * (this.meta.height / this.meta.width)));
    const dur = this.meta.durationSec;
    const times = Array.from({ length: n }, (_, i) => ((i + 0.5) * dur) / n);

    const sheet = document.createElement('canvas');
    sheet.width = thumbW * n;
    sheet.height = thumbH;
    const sctx = sheet.getContext('2d');
    if (!sctx) return null;

    // Use a dedicated Input so thumbnail decoding never contends with the
    // display sink reading from the main Input.
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(this.file) });
    try {
      const track = await input.getPrimaryVideoTrack();
      if (!track) return null;
      const thumbSink = new CanvasSink(track, { width: thumbW, height: thumbH, fit: 'cover', poolSize: 1 });
      let i = 0;
      for await (const wrapped of thumbSink.canvasesAtTimestamps(times)) {
        if (wrapped && wrapped.canvas) {
          sctx.drawImage(wrapped.canvas as CanvasImageSource, i * thumbW, 0, thumbW, thumbH);
        }
        i++;
      }
    } catch {
      return null;
    } finally {
      try {
        input.dispose();
      } catch {
        /* ignore */
      }
    }
    return { sheet, times, thumbW, thumbH };
  }

  dispose() {
    try {
      this.input?.dispose();
    } catch {
      /* ignore */
    }
    this.input = null;
    this.sink = null;
    this.file = null;
    this.displayCanvas = null;
    this.timestamps = [];
    this.meta = null;
  }
}
