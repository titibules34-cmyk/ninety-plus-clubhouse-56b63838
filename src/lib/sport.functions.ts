import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getLeagueOddsCached, getSportsCached } from "./odds.server";
import { MAX_PICKS, MIN_STAKE, marketOf, priceFor, totalOdds, type Pick } from "./odds";

const sportKey = z.string().regex(/^[a-z0-9_]{2,80}$/);

export const getSports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const sports = await getSportsCached();
      return { sports: sports.filter((s) => s.active && !s.has_outrights && s.group !== "Politics"), error: null };
    } catch {
      return { sports: [], error: "Ndeshjet nuk u ngarkuan" };
    }
  });

export const getLeagueOdds = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ sportKey }).parse(d))
  .handler(async ({ data }) => {
    try {
      const now = Date.now();
      const matches = (await getLeagueOddsCached(data.sportKey)).filter((m) => new Date(m.commenceTime).getTime() > now);
      return { matches, error: null };
    } catch {
      return { matches: [], error: "Kuotat nuk u ngarkuan" };
    }
  });

const PICKS = ["home", "draw", "away", "over", "under"] as const;

const placeInput = z.object({
  stake: z.number().finite().min(MIN_STAKE).max(100_000_000),
  picks: z
    .array(z.object({ eventId: z.string().min(1).max(100), sportKey, pick: z.enum(PICKS), odds: z.number().positive() }))
    .min(1)
    .max(MAX_PICKS),
});

export const placeBet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => placeInput.parse(d))
  .handler(async ({ data, context }) => {
    if (new Set(data.picks.map((p) => p.eventId)).size !== data.picks.length)
      return { ok: false as const, error: "Vetëm një zgjedhje për ndeshje" };

    // Prices are re-read on the server; the browser's numbers are only used to detect changes.
    const leagues = new Map<string, Awaited<ReturnType<typeof getLeagueOddsCached>>>();
    for (const key of new Set(data.picks.map((p) => p.sportKey))) leagues.set(key, await getLeagueOddsCached(key));

    const now = Date.now();
    const selections = [];
    for (const p of data.picks) {
      const match = leagues.get(p.sportKey)?.find((m) => m.id === p.eventId);
      if (!match) return { ok: false as const, error: "Një ndeshje nuk është më e disponueshme", changed: true };
      if (new Date(match.commenceTime).getTime() <= now) return { ok: false as const, error: `${match.home} - ${match.away} ka filluar`, changed: true };
      const price = priceFor(match, p.pick as Pick);
      if (!price) return { ok: false as const, error: "Një kuotë nuk është më e disponueshme", changed: true };
      if (Math.abs(price.odds - p.odds) > 0.001) return { ok: false as const, error: "Kuotat kanë ndryshuar, kontrolloni biletën", changed: true };
      selections.push({
        event_id: match.id, sport_key: match.sportKey, sport_title: match.sportTitle, home_team: match.home, away_team: match.away,
        commence_time: match.commenceTime, market: marketOf(p.pick as Pick), pick: p.pick, point: price.point, odds: price.odds,
      });
    }
    const stake = Math.round(data.stake * 100) / 100;
    const odds = totalOdds(selections.map((s) => s.odds));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("place_bet", {
      _user_id: context.userId, _stake: stake, _total_odds: odds, _selections: selections as never,
    });
    if (error) {
      const msg = error.message;
      if (msg.includes("INSUFFICIENT_FUNDS")) return { ok: false as const, error: "Nuk keni fonde të mjaftueshme" };
      if (msg.includes("ACCOUNT_BLOCKED")) return { ok: false as const, error: "Llogaria juaj nuk është aktive" };
      console.error("place_bet failed", msg);
      return { ok: false as const, error: "Basti nuk u vendos" };
    }
    const row = rows?.[0];
    return { ok: true as const, code: row?.bet_code ?? "", totalOdds: odds, potentialWin: Math.round(stake * odds * 100) / 100 };
  });
