import { EncodedPacketSink, type InputVideoTrack } from 'mediabunny';

export interface FrameIndex {
  /** Sorted presentation timestamps (seconds), one per frame, in display order. */
  timestamps: number[];
  fps: number;
}

/**
 * Build a frame-accurate index by walking the track's *encoded* packets — this
 * reads timestamps WITHOUT decoding pixels, so it is cheap even for long videos.
 *
 * Packets arrive in decode order (which differs from presentation order when the
 * codec uses B-frames), so we collect every presentation timestamp and sort it.
 * The resulting array maps `frameIndex -> exact presentation timestamp`, which is
 * the single source of truth the whole tool uses for seeking and rep marking.
 */
export async function buildFrameIndex(track: InputVideoTrack): Promise<FrameIndex> {
  const sink = new EncodedPacketSink(track);
  const timestamps: number[] = [];
  for await (const packet of sink.packets()) {
    timestamps.push(packet.timestamp);
  }
  timestamps.sort((a, b) => a - b);

  const fps = estimateFps(timestamps);
  return { timestamps, fps };
}

/** Estimate frame rate from the median inter-frame interval (robust to VFR jitter). */
function estimateFps(timestamps: number[]): number {
  if (timestamps.length < 2) return 30;
  const deltas: number[] = [];
  for (let i = 1; i < timestamps.length; i++) {
    const d = timestamps[i] - timestamps[i - 1];
    if (d > 0) deltas.push(d);
  }
  if (deltas.length === 0) return 30;
  deltas.sort((a, b) => a - b);
  const medianDelta = deltas[Math.floor(deltas.length / 2)];
  if (medianDelta <= 0) return 30;
  return 1 / medianDelta;
}
