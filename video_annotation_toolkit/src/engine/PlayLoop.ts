import { Input, CanvasSink } from 'mediabunny';

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
    makeInput: () => Input,
    startSec: number,
    speed: number,
    ctx: CanvasRenderingContext2D,
    dw: number,
    dh: number,
    onFrame: (timeSec: number) => void,
    onEnd: () => void,
    getClock: (() => number | null) | null = null,
  ): Promise<void> {
    this.stop();
    const token = ++this.runToken;
    this.stopped = false;

    let input: Input;
    try {
      input = makeInput();
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
        const clk = getClock ? getClock() : null;
        if (clk !== null && isFinite(clk)) {
          // Audio is the master clock: wait until audio reaches this frame's time
          // (but never block forever if audio stalls). When decode lags audio the
          // condition is already false, so we draw immediately and catch up.
          let guard = 0;
          while (
            !this.stopped &&
            token === this.runToken &&
            ((getClock!() ?? Infinity) < wrapped.timestamp - 0.006) &&
            guard < 600
          ) {
            await new Promise((r) => setTimeout(r, 8));
            guard++;
          }
        } else {
          // No audio clock: pace to the wall clock; sleep only when AHEAD of
          // schedule, never drop a frame (so the canvas always shows motion).
          const dueAt = wallStart + ((wrapped.timestamp - startSec) / speed) * 1000;
          const ahead = dueAt - performance.now();
          if (ahead > 4) await new Promise((r) => setTimeout(r, ahead));
        }
        if (this.stopped || token !== this.runToken) break;
        ctx.drawImage(wrapped.canvas as CanvasImageSource, 0, 0, dw, dh);
        if (++n % 2 === 0) onFrame(wrapped.timestamp);
      }
    } catch (err) {
      // decode/iterator errors end playback; surface for debugging (onEnd still fires below)
      console.warn('[PlayLoop] playback stopped on decode error:', err);
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
