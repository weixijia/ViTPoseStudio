import {
  Input,
  ALL_FORMATS,
  BlobSource,
  UrlSource,
  CanvasSink,
  type Source,
} from 'mediabunny';
import { buildFrameIndex } from './frameIndex';
import type { VideoMeta } from '../types';
import { clamp } from '../utils/time';

/** A video source: a picked File (drag/drop) or a served URL (auto-load). */
export type VideoSourceInput = File | { url: string; name: string };

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

  /** The loaded source — File (drag/drop) or served URL (auto-load). */
  file: File | null = null;
  url: string | null = null;
  /** A media URL usable by an <audio>/<video> element (object URL for files). */
  mediaUrl: string | null = null;
  private objectUrl: string | null = null;
  /** The display canvas the PlayLoop blits onto during playback (registered by VideoCanvas). */
  displayCanvas: HTMLCanvasElement | null = null;
  /** The frame index currently painted on the display canvas (skeleton syncs to THIS, not the
   *  scrub target, so the skeleton never lags the RGB during fast scrubbing). */
  shownFrame = 0;

  /** Exact presentation timestamp (seconds) for each frame index, in display order. */
  timestamps: number[] = [];
  meta: VideoMeta | null = null;

  /** Build a fresh Mediabunny Source for the current video (used per Input). */
  private makeSource(): Source {
    if (this.file) return new BlobSource(this.file);
    if (this.url) return new UrlSource(this.url);
    throw new Error('No video source loaded.');
  }

  /** A fresh decoder Input over the current source (the PlayLoop uses its own). */
  createInput(): Input {
    return new Input({ formats: ALL_FORMATS, source: this.makeSource() });
  }

  /** Load a File or a served URL: demux, build the frame index, prepare the decode sink. */
  async load(input0: VideoSourceInput): Promise<VideoMeta> {
    this.dispose();
    if (input0 instanceof File) {
      this.file = input0;
      this.objectUrl = URL.createObjectURL(input0);
      this.mediaUrl = this.objectUrl;
    } else {
      this.url = input0.url;
      this.mediaUrl = input0.url;
    }
    const name = input0 instanceof File ? input0.name : input0.name;

    const input = this.createInput();
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
    this.shownFrame = 0;
    this.timestamps = timestamps;
    this.meta = {
      name,
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

  dispose() {
    try {
      this.input?.dispose();
    } catch {
      /* ignore */
    }
    this.input = null;
    this.sink = null;
    this.file = null;
    this.url = null;
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.mediaUrl = null;
    this.displayCanvas = null;
    this.timestamps = [];
    this.meta = null;
  }
}
