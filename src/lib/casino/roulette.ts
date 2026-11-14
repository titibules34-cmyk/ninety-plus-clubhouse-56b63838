// European roulette, single zero.

export const WHEEL_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
export const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const colorOf = (n: number) => (n === 0 ? "green" : RED.has(n) ? "red" : "black");

export type RouletteBetType = "straight" | "red" | "black" | "even" | "odd" | "low" | "high" | "dozen" | "column";
export type RouletteBet = { type: RouletteBetType; value?: number | undefined; amount: number };

/** Return per 1 Lek staked (stake included) if the bet wins. */
export const RETURN: Record<RouletteBetType, number> = {
  straight: 36, red: 2, black: 2, even: 2, odd: 2, low: 2, high: 2, dozen: 3, column: 3,
};

export function betKey(b: Pick<RouletteBet, "type" | "value">) {
  return b.value == null ? b.type : `${b.type}:${b.value}`;
}

export function isValidBet(b: RouletteBet): boolean {
  if (!(b.amount > 0)) return false;
  if (b.type === "straight") return Number.isInteger(b.value) && b.value! >= 0 && b.value! <= 36;
  if (b.type === "dozen" || b.type === "column") return b.value === 1 || b.value === 2 || b.value === 3;
  return b.value == null;
}

export function betWins(b: RouletteBet, n: number): boolean {
  if (b.type === "straight") return n === b.value;
  if (n === 0) return false;
  switch (b.type) {
    case "red": return RED.has(n);
    case "black": return !RED.has(n);
    case "even": return n % 2 === 0;
    case "odd": return n % 2 === 1;
    case "low": return n <= 18;
    case "high": return n >= 19;
    case "dozen": return Math.ceil(n / 12) === b.value;
    case "column": return ((n - 1) % 3) + 1 === b.value;
  }
}

export function roulettePayout(bets: RouletteBet[], n: number): number {
  return Math.round(bets.reduce((sum, b) => sum + (betWins(b, n) ? b.amount * RETURN[b.type] : 0), 0) * 100) / 100;
}
