// Three-reel slot, one pay line (middle row). Returns 90% of stakes on average (see slots RTP test).

export const SYMBOLS = ["cherry", "lemon", "orange", "grape", "bell", "star", "seven"] as const;
export type SlotSymbol = (typeof SYMBOLS)[number];

export const SYMBOL_ICON: Record<SlotSymbol, string> = {
  cherry: "🍒", lemon: "🍋", orange: "🍊", grape: "🍇", bell: "🔔", star: "⭐", seven: "7️⃣",
};

/** How often each symbol lands on the line, out of 26, per reel. */
export const WEIGHTS: Record<SlotSymbol, number> = { cherry: 6, lemon: 5, orange: 5, grape: 4, bell: 3, star: 2, seven: 1 };

/** Return per 1 Lek staked (stake included). */
export const THREE_OF_A_KIND: Record<SlotSymbol, number> = {
  seven: 320, star: 100, bell: 50, grape: 25, orange: 15, lemon: 15, cherry: 10,
};
export const TWO_CHERRIES = 2.7;

/** Reel strip: every symbol repeated by its weight, spread out so neighbours vary. */
export const STRIP: SlotSymbol[] = (() => {
  const left = { ...WEIGHTS };
  const out: SlotSymbol[] = [];
  while (out.length < 26) {
    for (const s of SYMBOLS) if (left[s] > 0) { out.push(s); left[s]--; }
  }
  return out;
})();

export function lineMultiplier(line: SlotSymbol[]): number {
  const [a, b, c] = line;
  if (a === b && b === c) return THREE_OF_A_KIND[a!];
  if (line.filter((s) => s === "cherry").length === 2) return TWO_CHERRIES;
  return 0;
}

/** 3 columns x 3 rows (top, line, bottom) from reel stop positions. */
export function gridFromStops(stops: number[]): SlotSymbol[][] {
  const n = STRIP.length;
  return stops.map((i) => [STRIP[(i - 1 + n) % n]!, STRIP[i % n]!, STRIP[(i + 1) % n]!]);
}

/** Exact long-run return of the pay table. */
export function slotsRtp(): number {
  const total = STRIP.length;
  let rtp = 0;
  for (const a of SYMBOLS) for (const b of SYMBOLS) for (const c of SYMBOLS)
    rtp += (WEIGHTS[a] * WEIGHTS[b] * WEIGHTS[c]) / total ** 3 * lineMultiplier([a, b, c]);
  return rtp;
}
