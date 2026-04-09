/** Native <video> helpers for timeline + keyboard (no Video.js). */

export function transportCurrentTime(el: HTMLVideoElement | null): number {
  return el?.currentTime ?? 0;
}

export function transportSetCurrentTime(el: HTMLVideoElement | null, t: number) {
  if (el) el.currentTime = t;
}

export function transportDuration(el: HTMLVideoElement | null): number {
  if (!el) return 0;
  const d = el.duration;
  return Number.isFinite(d) && d > 0 ? d : 0;
}

export function transportPaused(el: HTMLVideoElement | null): boolean {
  return el?.paused ?? true;
}

export function transportPlay(el: HTMLVideoElement | null) {
  if (el) void el.play();
}

export function transportPause(el: HTMLVideoElement | null) {
  el?.pause();
}
