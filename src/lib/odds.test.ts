import { describe, expect, it } from "vitest";
import { gradePick, isLive, normalizeEvent, totalOdds } from "./odds";

describe("ticket odds", () => {
  it("multiplies the picks", () => {
    expect(totalOdds([1.5, 2])).toBe(3);
    expect(totalOdds([1.81, 2.05, 1.47])).toBe(5.45);
  });
});

describe("grading picks", () => {
  it("1 / X / 2 follow the final score", () => {
    expect(gradePick("home", null, 2, 1)).toBe("won");
    expect(gradePick("home", null, 1, 1)).toBe("lost");
    expect(gradePick("draw", null, 1, 1)).toBe("won");
    expect(gradePick("away", null, 0, 3)).toBe("won");
  });
  it("over/under against the line, refunded exactly on the line", () => {
    expect(gradePick("over", 2.5, 2, 1)).toBe("won");
    expect(gradePick("under", 2.5, 2, 1)).toBe("lost");
    expect(gradePick("over", 3, 2, 1)).toBe("void");
  });
});

describe("normalizing provider odds", () => {
  it("averages bookmakers and keeps the most quoted totals line", () => {
    const m = normalizeEvent({
      id: "e1", sport_key: "soccer_epl", sport_title: "EPL", commence_time: "2026-11-21T12:30:00Z",
      home_team: "A", away_team: "B",
      bookmakers: [
        { key: "x", markets: [
          { key: "h2h", outcomes: [{ name: "A", price: 2 }, { name: "B", price: 3 }, { name: "Draw", price: 3.4 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.8, point: 2.5 }, { name: "Under", price: 2, point: 2.5 }] },
        ] },
        { key: "y", markets: [
          { key: "h2h", outcomes: [{ name: "A", price: 2.2 }, { name: "B", price: 3.2 }, { name: "Draw", price: 3.6 }] },
          { key: "totals", outcomes: [{ name: "Over", price: 1.9, point: 2.5 }, { name: "Under", price: 1.9, point: 2.5 }] },
        ] },
        { key: "z", markets: [
          { key: "totals", outcomes: [{ name: "Over", price: 2.4, point: 3.5 }, { name: "Under", price: 1.6, point: 3.5 }] },
        ] },
      ],
    });
    expect(m.h2h).toEqual({ home: 2.1, draw: 3.5, away: 3.1 });
    expect(m.totals).toEqual({ point: 2.5, over: 1.85, under: 1.95 });
  });
});

describe("live games", () => {
  const base = { id: "x", sportKey: "soccer_epl", sportTitle: "EPL", home: "A", away: "B", h2h: { home: 2, draw: 3, away: 4 }, totals: null };
  const now = Date.parse("2026-11-12T12:00:00Z");
  it("counts a game as live from kick-off for up to 4 hours", () => {
    expect(isLive({ ...base, commenceTime: "2026-11-12T12:05:00Z" }, now)).toBe(false);
    expect(isLive({ ...base, commenceTime: "2026-11-12T11:00:00Z" }, now)).toBe(true);
    expect(isLive({ ...base, commenceTime: "2026-11-12T07:59:00Z" }, now)).toBe(false);
  });
  it("hides started games nobody prices anymore", () => {
    expect(isLive({ ...base, commenceTime: "2026-11-12T11:00:00Z", h2h: { home: null, draw: null, away: null } }, now)).toBe(false);
  });
});
