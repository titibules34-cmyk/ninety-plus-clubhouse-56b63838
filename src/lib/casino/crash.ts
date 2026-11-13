// Crash: a multiplier climbs from 1.00x; cash out before the hidden crash point.
// Crash point = 0.90 / U (U uniform in (0,1]), so cashing out at any target returns 90% on average.

export const CRASH_RTP = 0.9;
export const CRASH_MAX = 1000;
const GROWTH = 0.07; // per second: 2x after ~10s, 10x after ~33s

export function multiplierAt(elapsedMs: number): number {
  return Math.floor(Math.exp(GROWTH * Math.max(0, elapsedMs) / 1000) * 100) / 100;
}
export function msToReach(mult: number): number {
  return (Math.log(mult) / GROWTH) * 1000;
}
export function crashPointFrom(u: number): number {
  const raw = Math.floor((CRASH_RTP / u) * 100) / 100;
  return Math.min(CRASH_MAX, Math.max(1, raw));
}
