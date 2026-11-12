import { isLive, normalizeEvent, type MatchOdds, type RawEvent, type RawSport } from "./odds";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_the_odds_api";
/** Each league refresh costs provider credits, so prices are reused for this long. */
export const ODDS_TTL_MS = 20 * 60 * 1000;
const SPORTS_TTL_MS = 6 * 60 * 60 * 1000;

export async function oddsApi<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["UDC_THE_ODDS_API_API_KEY"];
  if (!lovableKey || !connKey) throw new Error("Odds service is not connected");
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GATEWAY_URL}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Odds API ${path} failed [${res.status}]: ${body}`);
    throw new Error(`Odds API failed [${res.status}]`);
  }
  return (await res.json()) as T;
}

async function cached<T>(key: string, ttl: number, load: () => Promise<T>, maxStaleMs = Infinity): Promise<T> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("odds_cache").select("data, fetched_at").eq("cache_key", key).maybeSingle();
  if (data && Date.now() - new Date(data.fetched_at).getTime() < ttl) return data.data as T;
  try {
    const fresh = await load();
    await supabaseAdmin.from("odds_cache").upsert({ cache_key: key, data: fresh as never, fetched_at: new Date().toISOString() });
    return fresh;
  } catch (e) {
    // serve stale prices rather than nothing (live prices only while still recent)
    if (data && Date.now() - new Date(data.fetched_at).getTime() < maxStaleMs) return data.data as T;
    throw e;
  }
}

export function getSportsCached(): Promise<RawSport[]> {
  return cached("sports", SPORTS_TTL_MS, () => oddsApi<RawSport[]>("/v4/sports"));
}

export function getLeagueOddsCached(sportKey: string): Promise<MatchOdds[]> {
  return cached(`odds:${sportKey}`, ODDS_TTL_MS, async () => {
    const raw = await oddsApi<RawEvent[]>(`/v4/sports/${encodeURIComponent(sportKey)}/odds`, {
      regions: "eu",
      markets: "h2h,totals",
      oddsFormat: "decimal",
    });
    return raw.map(normalizeEvent).sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
  });
}

/** In-play prices move fast: refreshed every minute while someone is watching, never served older than 3 minutes. */
export const LIVE_TTL_MS = 60 * 1000;
const LIVE_MAX_STALE_MS = 3 * 60 * 1000;
const SCORES_TTL_MS = 2 * 60 * 1000;

export function getLiveOddsCached(): Promise<MatchOdds[]> {
  return cached("live", LIVE_TTL_MS, async () => {
    // "upcoming" returns in-play games plus the next ones across all sports in a single call.
    const raw = await oddsApi<RawEvent[]>("/v4/sports/upcoming/odds", { regions: "eu", markets: "h2h,totals", oddsFormat: "decimal" });
    const now = Date.now();
    return raw.map(normalizeEvent).filter((m) => isLive(m, now));
  }, LIVE_MAX_STALE_MS).then((all) => all.filter((m) => isLive(m, Date.now())));
}

type RawScore = { id: string; completed: boolean; home_team: string; away_team: string; scores: { name: string; score: string }[] | null };
export type LiveScore = { home: string; away: string };

/** Current score per match id, only for leagues that have live games (1 provider credit per league refresh). */
export async function getLiveScoresCached(sportKeys: string[]): Promise<Record<string, LiveScore>> {
  const out: Record<string, LiveScore> = {};
  await Promise.all(sportKeys.map(async (key) => {
    try {
      const rows = await cached(`scores:${key}`, SCORES_TTL_MS, () => oddsApi<RawScore[]>(`/v4/sports/${encodeURIComponent(key)}/scores`), 10 * 60 * 1000);
      for (const r of rows) {
        if (r.completed || !r.scores) continue;
        const h = r.scores.find((x) => x.name === r.home_team)?.score;
        const a = r.scores.find((x) => x.name === r.away_team)?.score;
        if (h != null && a != null) out[r.id] = { home: h, away: a };
      }
    } catch { /* scores are optional */ }
  }));
  return out;
}
