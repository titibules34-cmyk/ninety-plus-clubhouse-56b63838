import { describe, expect, it } from "vitest";
import { slotsRtp, lineMultiplier, STRIP, WEIGHTS } from "./slots";
import { roulettePayout, betWins } from "./roulette";
import { handValue, outcome, BJ_RETURN, dealerPlay } from "./blackjack";
import { crashPointFrom, multiplierAt, msToReach } from "./crash";

describe("slots", () => {
  it("returns 90% of stakes on average", () => {
    expect(slotsRtp()).toBeGreaterThan(0.895);
    expect(slotsRtp()).toBeLessThan(0.905);
  });
  it("strip matches the symbol weights", () => {
    expect(STRIP.length).toBe(26);
    expect(STRIP.filter((s) => s === "seven").length).toBe(WEIGHTS.seven);
  });
  it("pays three sevens 320x and two cherries 2.7x", () => {
    expect(lineMultiplier(["seven", "seven", "seven"])).toBe(320);
    expect(lineMultiplier(["cherry", "bell", "cherry"])).toBe(2.7);
    expect(lineMultiplier(["cherry", "bell", "lemon"])).toBe(0);
  });
});

describe("crash", () => {
  it("cashing out at any target returns 90% on average", () => {
    for (const target of [1.5, 2, 5, 10]) {
      // P(crash point > target) * target, integrated over U
      const steps = 200000;
      let ev = 0;
      for (let i = 1; i <= steps; i++) if (crashPointFrom(i / steps) > target) ev += target / steps;
      expect(ev).toBeGreaterThan(0.88);
      expect(ev).toBeLessThanOrEqual(0.9);
    }
  });
  it("starts at 1.00x and grows", () => {
    expect(multiplierAt(0)).toBe(1);
    expect(multiplierAt(msToReach(2) + 1)).toBe(2);
  });
});

describe("roulette", () => {
  it("pays a straight number 36x stake back and loses outside bets on zero", () => {
    expect(roulettePayout([{ type: "straight", value: 17, amount: 10 }], 17)).toBe(360);
    expect(roulettePayout([{ type: "red", amount: 10 }], 0)).toBe(0);
    expect(roulettePayout([{ type: "dozen", value: 2, amount: 10 }], 13)).toBe(30);
  });
  it("columns follow the table layout", () => {
    expect(betWins({ type: "column", value: 1, amount: 1 }, 34)).toBe(true);
    expect(betWins({ type: "column", value: 3, amount: 1 }, 36)).toBe(true);
  });
});

describe("blackjack", () => {
  const A = 0, K = 12, NINE = 8, SIX = 5, SEVEN = 6;
  it("counts aces as 1 or 11", () => {
    expect(handValue([A, K]).total).toBe(21);
    expect(handValue([A, NINE, K]).total).toBe(20);
  });
  it("blackjack pays 3:2, a push returns the stake", () => {
    expect(BJ_RETURN[outcome([A, K], [K, NINE])]).toBe(2.5);
    expect(outcome([K, NINE], [NINE, K])).toBe("push");
    expect(outcome([K, K, 2], [NINE, SEVEN])).toBe("lose");
  });
  it("dealer stands on soft 17", () => {
    expect(dealerPlay([A, SIX], [K]).dealer.length).toBe(2);
  });
});
