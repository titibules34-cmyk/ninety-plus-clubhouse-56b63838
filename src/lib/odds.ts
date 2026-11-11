// Shared, browser-safe odds helpers. Provider data comes from The Odds API (v4).

export type RawOutcome = { name: string; price: number; point?: number };
export type RawEvent = {
  id: string;
  sport_key: string;
  sport_title: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  bookmakers?: { key: string; markets: { key: string; outcomes: RawOutcome[] }[] }[];
};
export type RawSport = { key: string; group: string; title: string; active: boolean; has_outrights: boolean };

export type Pick = "home" | "draw" | "away" | "over" | "under";
export type Market = "h2h" | "totals";

export type MatchOdds = {
  id: string;
  sportKey: string;
  sportTitle: string;
  commenceTime: string;
  home: string;
  away: string;
  h2h: { home: number | null; draw: number | null; away: number | null };
  totals: { point: number; over: number; under: number } | null;
};

export type SlipPick = {
  eventId: string;
  sportKey: string;
  sportTitle: string;
  home: string;
  away: string;
  commenceTime: string;
  pick: Pick;
  odds: number;
  point: number | null;
};

export const marketOf = (pick: Pick): Market => (pick === "over" || pick === "under" ? "totals" : "h2h");

const round2 = (n: number) => Math.round(n * 100) / 100;
const avg = (xs: number[]) => (xs.length ? round2(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

/** Collapse every bookmaker's prices into one price per outcome (average), and one Over/Under line. */
export function normalizeEvent(e: RawEvent): MatchOdds {
  const home: number[] = [], draw: number[] = [], away: number[] = [];
  const totalsByPoint = new Map<number, { over: number[]; under: number[] }>();
  for (const b of e.bookmakers ?? []) {
    for (const m of b.markets) {
      if (m.key === "h2h") {
        for (const o of m.outcomes) {
          if (o.name === e.home_team) home.push(o.price);
          else if (o.name === e.away_team) away.push(o.price);
          else if (o.name === "Draw") draw.push(o.price);
        }
      } else if (m.key === "totals") {
        for (const o of m.outcomes) {
          if (o.point == null) continue;
          const t = totalsByPoint.get(o.point) ?? { over: [], under: [] };
          if (o.name === "Over") t.over.push(o.price);
          else if (o.name === "Under") t.under.push(o.price);
          totalsByPoint.set(o.point, t);
        }
      }
    }
  }
  // Main line = the one most bookmakers quote (both sides present).
  let totals: MatchOdds["totals"] = null;
  let best = 0;
  for (const [point, t] of totalsByPoint) {
    const n = Math.min(t.over.length, t.under.length);
    if (n > best) { best = n; totals = { point, over: avg(t.over)!, under: avg(t.under)! }; }
  }
  return {
    id: e.id,
    sportKey: e.sport_key,
    sportTitle: e.sport_title,
    commenceTime: e.commence_time,
    home: e.home_team,
    away: e.away_team,
    h2h: { home: avg(home), draw: avg(draw), away: avg(away) },
    totals,
  };
}

/** Current price and line for a pick on a match, or null when not offered. */
export function priceFor(m: MatchOdds, pick: Pick): { odds: number; point: number | null } | null {
  if (pick === "over" || pick === "under") return m.totals ? { odds: m.totals[pick], point: m.totals.point } : null;
  const odds = m.h2h[pick];
  return odds == null ? null : { odds, point: null };
}

/** Ticket odds: product of the picks, 2 decimals. */
export const totalOdds = (odds: number[]) => round2(odds.reduce((a, b) => a * b, 1));

/** Result of one pick once the final score is known. Over/Under exactly on the line is refunded (void). */
export function gradePick(pick: Pick, point: number | null, homeScore: number, awayScore: number): "won" | "lost" | "void" {
  switch (pick) {
    case "home": return homeScore > awayScore ? "won" : "lost";
    case "away": return awayScore > homeScore ? "won" : "lost";
    case "draw": return homeScore === awayScore ? "won" : "lost";
    case "over":
    case "under": {
      if (point == null) return "void";
      const goals = homeScore + awayScore;
      if (goals === point) return "void";
      return (pick === "over") === goals > point ? "won" : "lost";
    }
  }
}

export const MAX_PICKS = 20;
export const MIN_STAKE = 1;
