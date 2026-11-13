// Blackjack: 6 decks shuffled every round, dealer stands on all 17s, blackjack pays 3:2, double on the first two cards.

export type Card = number; // 0..51; rank = card % 13 (0 = Ace … 12 = King), suit = floor(card / 13) % 4
const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = ["♠", "♥", "♦", "♣"];
export const cardLabel = (c: Card) => ({ rank: RANKS[c % 13]!, suit: SUITS[Math.floor(c / 13) % 4]!, red: Math.floor(c / 13) % 4 === 1 || Math.floor(c / 13) % 4 === 2 });
export const SHOE = Array.from({ length: 52 * 6 }, (_, i) => i % 52);

export function handValue(cards: Card[]): { total: number; soft: boolean } {
  let total = 0, aces = 0;
  for (const c of cards) {
    const r = c % 13;
    if (r === 0) { aces++; total += 1; } else total += Math.min(10, r + 1);
  }
  const soft = aces > 0 && total + 10 <= 21;
  return { total: soft ? total + 10 : total, soft };
}
export const isBlackjack = (cards: Card[]) => cards.length === 2 && handValue(cards).total === 21;

/** Dealer draws to 17 (stands on soft 17). */
export function dealerPlay(dealer: Card[], deck: Card[]): { dealer: Card[]; deck: Card[] } {
  const d = [...dealer], rest = [...deck];
  while (handValue(d).total < 17) d.push(rest.shift()!);
  return { dealer: d, deck: rest };
}

export type BjOutcome = "blackjack" | "win" | "push" | "lose";
/** Return per 1 Lek staked (stake included). */
export const BJ_RETURN: Record<BjOutcome, number> = { blackjack: 2.5, win: 2, push: 1, lose: 0 };

export function outcome(player: Card[], dealer: Card[]): BjOutcome {
  const pb = isBlackjack(player), db = isBlackjack(dealer);
  if (pb && db) return "push";
  if (pb) return "blackjack";
  if (db) return "lose";
  const p = handValue(player).total, d = handValue(dealer).total;
  if (p > 21) return "lose";
  if (d > 21 || p > d) return "win";
  return p === d ? "push" : "lose";
}
