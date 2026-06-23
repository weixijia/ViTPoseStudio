/**
 * Audio playback via a hidden <audio> element fed the original file (object URL).
 * The video is decoded frame-by-frame on a canvas (WebCodecs); audio can't be
 * driven that way for smooth sound, so we let the browser play the file's audio
 * track natively and use ITS clock as the playback master, syncing video to it.
 *
 * Requires the browser to support the file's container/codecs (true on macOS /
 * Windows for H.264 & HEVC). If audio can't play, playback falls back to a wall
 * clock and runs silently — never blocks the video.
 */
/** Don't reseek the audio element for sub-frame drift (avoids audible stutter). */
const SEEK_EPSILON = 0.05;

export class AudioPlayer {
  private el: HTMLAudioElement | null = null;
  private url: string | null = null;

  /** Load by media URL (the engine supplies an object URL for files, or a served URL). */
  load(mediaUrl: string) {
    this.dispose();
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.src = mediaUrl;
    el.load();
    this.el = el;
    this.url = null; // engine owns the object URL; we don't revoke it here
  }

  /** Whether the element is actively playing (used to decide if it can be the clock). */
  isPlaying(): boolean {
    return !!this.el && !this.el.paused && !this.el.ended;
  }

  /** Current media time in seconds. */
  get currentTime(): number {
    return this.el ? this.el.currentTime : 0;
  }

  get hasAudio(): boolean {
    return !!this.el;
  }

  /** Start playback from `fromSec` at `rate`. Returns false if blocked/unavailable. */
  async play(fromSec: number, rate: number, muted: boolean): Promise<boolean> {
    const el = this.el;
    if (!el) return false;
    try {
      el.muted = muted;
      el.playbackRate = rate;
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
      if (Math.abs(el.currentTime - fromSec) > SEEK_EPSILON) el.currentTime = fromSec;
      await el.play();
      return true;
    } catch {
      return false;
    }
  }

  pause() {
    this.el?.pause();
  }

  /** Move the playhead (used while paused so the next play starts aligned). */
  seek(sec: number) {
    if (this.el && Math.abs(this.el.currentTime - sec) > SEEK_EPSILON) this.el.currentTime = sec;
  }

  setMuted(muted: boolean) {
    if (this.el) this.el.muted = muted;
  }

  dispose() {
    if (this.el) {
      this.el.pause();
      this.el.removeAttribute('src');
      try {
        this.el.load();
      } catch {
        /* ignore */
      }
    }
    if (this.url) URL.revokeObjectURL(this.url);
    this.el = null;
    this.url = null;
  }
}

export const audioPlayer = new AudioPlayer();
