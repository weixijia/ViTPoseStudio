import { Input, ALL_FORMATS, BlobSource, CanvasSink } from 'mediabunny';

/**
 * Smooth forward playback via Mediabunny's *sequential* canvas iterator.
 *
 * Re-seeking every frame (getCanvas per rAF) is the wrong tool for playback — it
 * does dozens of random-access decodes per second. Instead we decode frames in
 * order with `CanvasSink.canvases(start)` and pace each to a wall clock, dropping
 * late frames to stay in sync. Frame-exact display while paused stays on the
 * engine's single-getCanvas path (VideoCanvas); this loop only runs while playing.
 */
export class PlayLoop {
  private stopped = true;
  private input: Input | null = null;
  private runToken = 0;

  /**
   * Play forward from `startSec`, blitting onto `ctx` sized `dw×dh`.
   * @param onFrame called ~every 4th displayed frame with its timestamp (to sync the store playhead)
   * @param onEnd   called once when the clip end is reached (not on manual stop)
   */
  async run(
    file: File,
    startSec: number,
    speed: number,
    ctx: CanvasRenderingContext2D,
    dw: number,
    dh: number,
    onFrame: (timeSec: number) => void,
    onEnd: () => void,
  ): Promise<void> {
    this.stop();
    const token = ++this.runToken;
    this.stopped = false;

    let input: Input;
    try {
      input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    } catch {
      return;
    }
    this.input = input;

    const track = await input.getPrimaryVideoTrack();
    if (!track || this.stopped || token !== this.runToken) {
      this.disposeIf(input);
      return;
    }
    const sink = new CanvasSink(track, { poolSize: 4 });
    const wallStart = performance.now();
    let n = 0;

    try {
      for await (const wrapped of sink.canvases(startSec)) {
        if (this.stopped || token !== this.runToken) break;
        const dueAt = wallStart + ((wrapped.timestamp - startSec) / speed) * 1000;
        const lag = dueAt - performance.now();
        if (lag > 2) {
          await new Promise((r) => setTimeout(r, lag - 1));
          if (this.stopped || token !== this.runToken) break;
        }
        // if we're way behind, skip drawing this frame but still advance the playhead
        if (performance.now() > dueAt + 60) {
          if (++n % 4 === 0) onFrame(wrapped.timestamp);
          continue;
        }
        ctx.drawImage(wrapped.canvas as CanvasImageSource, 0, 0, dw, dh);
        if (++n % 4 === 0) onFrame(wrapped.timestamp);
      }
    } catch {
      /* decode/iterator errors end playback quietly */
    }

    const reachedEnd = !this.stopped && token === this.runToken;
    this.disposeIf(input);
    if (reachedEnd) onEnd();
  }

  stop(): void {
    this.stopped = true;
    this.runToken++;
    this.disposeIf(this.input);
  }

  private disposeIf(input: Input | null) {
    if (!input) return;
    // Always dispose the given input (even if a newer run has overwritten
    // this.input), but only clear the pointer when it still matches.
    try {
      input.dispose();
    } catch {
      /* ignore */
    }
    if (input === this.input) this.input = null;
  }
}

export const playLoop = new PlayLoop();
