import { gradePick, type Pick } from "./odds";
import { oddsApi } from "./odds.server";

type Score = { id: string; completed: boolean; home_team: string; away_team: string; scores: { name: string; score: string }[] | null };

const STARTED_AGO_MS = 2 * 60 * 60 * 1000; // a match is checked once it started 2h ago
const GIVE_UP_MS = 4 * 24 * 60 * 60 * 1000; // no result after 4 days: pick is refunded

/** Pays out finished tickets. Only calls the odds service for leagues that have open picks. */
export async function settleOpenBets() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const cutoff = new Date(Date.now() - STARTED_AGO_MS).toISOString();
  const { data: open, error } = await supabaseAdmin
    .from("bet_selections")
    .select("id, event_id, sport_key, pick, point, commence_time")
    .eq("result", "pending")
    .lt("commence_time", cutoff)
    .limit(5000);
  if (error) throw new Error(error.message);
  if (!open?.length) return { checkedLeagues: 0, settledTickets: 0 };

  const results: { id: string; result: string; home_score?: number; away_score?: number }[] = [];
  const leagues = [...new Set(open.map((s) => s.sport_key))];
  for (const league of leagues) {
    let scores: Score[] = [];
    try {
      scores = await oddsApi<Score[]>(`/v4/sports/${encodeURIComponent(league)}/scores`, { daysFrom: "3" });
    } catch {
      continue; // try again next run
    }
    const byId = new Map(scores.map((s) => [s.id, s]));
    for (const sel of open.filter((s) => s.sport_key === league)) {
      const sc = byId.get(sel.event_id);
      if (sc?.completed && sc.scores) {
        const h = Number(sc.scores.find((x) => x.name === sc.home_team)?.score);
        const a = Number(sc.scores.find((x) => x.name === sc.away_team)?.score);
        if (Number.isFinite(h) && Number.isFinite(a)) {
          results.push({ id: sel.id, result: gradePick(sel.pick as Pick, sel.point == null ? null : Number(sel.point), h, a), home_score: h, away_score: a });
          continue;
        }
      }
      if (Date.now() - new Date(sel.commence_time).getTime() > GIVE_UP_MS) results.push({ id: sel.id, result: "void" });
    }
  }
  if (!results.length) return { checkedLeagues: leagues.length, settledTickets: 0 };
  const { data: settled, error: settleErr } = await supabaseAdmin.rpc("settle_selections", { _results: results as never });
  if (settleErr) throw new Error(settleErr.message);
  return { checkedLeagues: leagues.length, settledTickets: settled ?? 0 };
}
