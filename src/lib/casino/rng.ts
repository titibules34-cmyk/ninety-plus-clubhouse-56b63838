/** Uniform integer in [0, n) from the platform's cryptographic RNG (rejection sampling, no modulo bias). */
export function randomInt(n: number): number {
  if (n <= 0 || n > 2 ** 32) throw new Error("bad range");
  const limit = Math.floor(2 ** 32 / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0]! < limit) return buf[0]! % n;
  }
}

/** Uniform real in (0, 1]. */
export function randomUnit(): number {
  return (randomInt(2 ** 32 - 1) + 1) / (2 ** 32 - 1);
}

export function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
