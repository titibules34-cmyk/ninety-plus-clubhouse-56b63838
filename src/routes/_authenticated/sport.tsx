import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { PlayerShell, fmtMoney } from "@/components/PlayerShell";
import { getLeagueOdds, getSports, placeBet } from "@/lib/sport.functions";
import { MAX_PICKS, MIN_STAKE, priceFor, totalOdds, type MatchOdds, type Pick, type SlipPick } from "@/lib/odds";
import { useMe } from "@/lib/use-me";
import { available } from "@/lib/hierarchy";

export const Route = createFileRoute("/_authenticated/sport")({
  head: () => ({ meta: [{ title: "Sport — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Sport,
});

const GROUPS: Record<string, { label: string; icon: string }> = {
  Soccer: { label: "Futboll", icon: "sports_soccer" },
  Basketball: { label: "Basketboll", icon: "sports_basketball" },
  Tennis: { label: "Tenis", icon: "sports_tennis" },
  "Ice Hockey": { label: "Hokej", icon: "sports_hockey" },
  "American Football": { label: "Futboll Amerikan", icon: "sports_football" },
  "Aussie Rules": { label: "Aussie Rules", icon: "sports_rugby" },
  "Rugby Union": { label: "Rugby Union", icon: "sports_rugby" },
  Baseball: { label: "Bejsboll", icon: "sports_baseball" },
  Cricket: { label: "Kriket", icon: "sports_cricket" },
  Golf: { label: "Golf", icon: "golf_course" },
  Boxing: { label: "Boks", icon: "sports_mma" },
  "Mixed Martial Arts": { label: "MMA", icon: "sports_kabaddi" },
};
// League shown first when a sport is opened (only one is loaded by default to save odds credits).
const PREFERRED = ["soccer_uefa_nations_league", "soccer_uefa_champs_league", "soccer_epl", "soccer_spain_la_liga", "soccer_italy_serie_a", "basketball_nba", "basketball_euroleague", "icehockey_nhl"];
const PICK_LABEL: Record<Pick, string> = { home: "1", draw: "X", away: "2", over: "Lart", under: "Poshtë" };

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-GB");
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
const shortCode = (id: string) => String(parseInt(id.slice(0, 6), 16) % 9000 + 1000);

function Sport() {
  const fetchSports = useServerFn(getSports);
  const fetchOdds = useServerFn(getLeagueOdds);
  const doPlace = useServerFn(placeBet);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: me } = useMe();

  const { data: sportsRes, isLoading: sportsLoading } = useQuery({ queryKey: ["sports"], queryFn: () => fetchSports(), staleTime: 30 * 60 * 1000 });
  const sports = sportsRes?.sports ?? [];
  const groups = useMemo(() => [...new Set(sports.map((s) => s.group))].sort((a, b) => (a === "Soccer" ? -1 : b === "Soccer" ? 1 : a.localeCompare(b))), [sports]);
  const [group, setGroup] = useState("Soccer");
  const leagues = sports.filter((s) => s.group === group);
  const [selected, setSelected] = useState<string[]>([]);

  // Open one league per sport by default.
  useEffect(() => {
    if (!leagues.length) return;
    if (selected.some((k) => leagues.some((l) => l.key === k))) return;
    const first = PREFERRED.find((k) => leagues.some((l) => l.key === k)) ?? leagues[0]!.key;
    setSelected([first]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group, sports.length]);

  const shown = selected.filter((k) => leagues.some((l) => l.key === k));
  const odds = useQueries({
    queries: shown.map((k) => ({ queryKey: ["odds", k], queryFn: () => fetchOdds({ data: { sportKey: k } }), staleTime: 5 * 60 * 1000 })),
    combine: (rs) => ({
      all: rs.flatMap((r) => r.data?.matches ?? []),
      loading: rs.some((r) => r.isLoading),
      error: rs.find((r) => r.data?.error)?.data?.error ?? null,
    }),
  });
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const all = odds.all;
    const needle = q.trim().toLowerCase();
    return all
      .filter((m) => !needle || m.home.toLowerCase().includes(needle) || m.away.toLowerCase().includes(needle))
      .sort((a, b) => a.commenceTime.localeCompare(b.commenceTime));
  }, [odds.all, q]);
  const oddsLoading = odds.loading;
  const oddsError = odds.error;

  // Group rows by day, then league.
  const sections = useMemo(() => {
    const out: { key: string; day: string; league: string; rows: MatchOdds[] }[] = [];
    for (const m of matches) {
      const key = `${dayKey(m.commenceTime)}|${m.sportKey}`;
      const last = out[out.length - 1];
      if (last?.key === key) last.rows.push(m);
      else out.push({ key, day: dayKey(m.commenceTime), league: m.sportTitle, rows: [m] });
    }
    return out;
  }, [matches]);

  // Betslip
  const [slip, setSlip] = useState<SlipPick[]>([]);
  const [stake, setStake] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState("");

  function toggle(m: MatchOdds, pick: Pick) {
    const price = priceFor(m, pick);
    if (!price) return;
    setMsg(null);
    setSlip((s) => {
      const existing = s.find((x) => x.eventId === m.id);
      if (existing?.pick === pick) return s.filter((x) => x.eventId !== m.id);
      if (!existing && s.length >= MAX_PICKS) return s;
      const item: SlipPick = { eventId: m.id, sportKey: m.sportKey, sportTitle: m.sportTitle, home: m.home, away: m.away, commenceTime: m.commenceTime, pick, odds: price.odds, point: price.point };
      return existing ? s.map((x) => (x.eventId === m.id ? item : x)) : [...s, item];
    });
  }
  const isPicked = (id: string, pick: Pick) => slip.some((x) => x.eventId === id && x.pick === pick);
  const slipOdds = totalOdds(slip.map((s) => s.odds));
  const stakeNum = Number(stake.replace(",", "."));
  const funds = me?.profile ? available(me.profile) : 0;

  async function submit() {
    setMsg(null);
    if (!slip.length) return;
    if (!Number.isFinite(stakeNum) || stakeNum < MIN_STAKE) return setMsg({ ok: false, text: "Vendosni shumën e bastit" });
    if (stakeNum > funds) return setMsg({ ok: false, text: "Nuk keni fonde të mjaftueshme" });
    setBusy(true);
    try {
      const r = await doPlace({ data: { stake: stakeNum, picks: slip.map((s) => ({ eventId: s.eventId, sportKey: s.sportKey, pick: s.pick, odds: s.odds })) } });
      if (r.ok) {
        setSlip([]); setStake("");
        setMsg({ ok: true, text: `Basti u vendos. Kodi i biletës: ${r.code}` });
        qc.invalidateQueries({ queryKey: ["me"] });
      } else {
        setMsg({ ok: false, text: r.error });
        if ("changed" in r && r.changed) {
          await qc.invalidateQueries({ queryKey: ["odds"] });
        }
      }
    } catch {
      setMsg({ ok: false, text: "Basti nuk u vendos" });
    }
    setBusy(false);
  }

  // Keep slip prices in sync with refreshed odds (player sees the change before placing).
  useEffect(() => {
    setSlip((s) => {
      let changed = false;
      const next = s.map((x) => {
        const m = matches.find((mm) => mm.id === x.eventId);
        const p = m && priceFor(m, x.pick);
        if (!p || (p.odds === x.odds && p.point === x.point)) return x;
        changed = true;
        return { ...x, odds: p.odds, point: p.point };
      });
      return changed ? next : s;
    });
  }, [matches]);

  const groupLabel = GROUPS[group]?.label ?? group;

  return (
    <PlayerShell>
      <div className="pl-sports">
        {groups.map((g) => (
          <button key={g} className={`pl-sport ${g === group ? "is-active" : ""}`} onClick={() => setGroup(g)}>
            <i className="material-icons">{GROUPS[g]?.icon ?? "emoji_events"}</i>
            {GROUPS[g]?.label ?? g}
          </button>
        ))}
      </div>

      <div className="pl-grid">
        <aside className="pl-box">
          <div className="pl-box-head">Kërko Ndeshje</div>
          <div className="pl-search">
            <i className="material-icons">search</i>
            <input placeholder="Kërko" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button onClick={() => setQ("")} aria-label="Pastro"><i className="material-icons">close</i></button>}
          </div>
          <div className="pl-box-head">{groupLabel}</div>
          <div className="pl-leagues">
            {sportsLoading && <div className="pl-empty">Duke ngarkuar…</div>}
            {sportsRes?.error && <div className="pl-err">{sportsRes.error}</div>}
            {leagues.map((l) => (
              <label key={l.key} className="pl-league">
                <input
                  type="checkbox"
                  checked={selected.includes(l.key)}
                  onChange={() => setSelected((s) => (s.includes(l.key) ? s.filter((k) => k !== l.key) : [...s, l.key]))}
                />
                <span>{l.title}</span>
              </label>
            ))}
          </div>
        </aside>

        <section className="pl-box">
          <table className="pl-odds-table">
            <colgroup>
              <col style={{ width: 100 }} /><col />
              <col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="title" colSpan={2}>{groupLabel}</th>
                <th colSpan={3}>1x2<div className="sub"><span>1</span><span>X</span><span>2</span></div></th>
                <th colSpan={3}>TG_L/P<div className="sub"><span>sbv</span><span>Lart</span><span>Poshtë</span></div></th>
              </tr>
            </thead>
            <tbody>
              {oddsLoading && <tr><td colSpan={8} className="pl-empty">Duke ngarkuar ndeshjet…</td></tr>}
              {oddsError && <tr><td colSpan={8} className="pl-err">{oddsError}</td></tr>}
              {!oddsLoading && !oddsError && sections.length === 0 && (
                <tr><td colSpan={8} className="pl-empty">{shown.length ? "Nuk ka ndeshje" : "Zgjidhni një kampionat në të majtë"}</td></tr>
              )}
              {sections.map((sec) => (
                <SectionRows key={sec.key} sec={sec} isPicked={isPicked} toggle={toggle} />
              ))}
            </tbody>
          </table>
        </section>

        <aside>
          <div className="pl-box">
            <div className="pl-box-head center">Kërko Biletën</div>
            <div className="pl-field"><input placeholder="Vendos Kodin e Biletës" value={ticket} onChange={(e) => setTicket(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ticket.trim() && navigate({ to: "/biletat", search: { kodi: ticket.trim() } })} /></div>
            <button className="pl-btn" disabled={!ticket.trim()} onClick={() => navigate({ to: "/biletat", search: { kodi: ticket.trim() } })}>Kërko Për Biletën</button>
          </div>
          <div className="pl-box" style={{ marginTop: 8 }}>
            <div className="pl-box-head">
              <span>Betslip<span className="pl-count">{slip.length}</span></span>
              {slip.length > 0 && <button onClick={() => setSlip([])} aria-label="Fshi të gjitha" style={{ cursor: "pointer", display: "flex" }}><i className="material-icons">delete</i></button>}
            </div>
            {slip.length === 0 && <div className="pl-field"><div className="pl-empty" style={{ background: "var(--pl-bg)" }}>Asnjë Bast i Zgjedhur</div></div>}
            {slip.map((s) => (
              <div key={s.eventId} className="pl-slip-item">
                <span className="teams">{s.home} - {s.away}</span>
                <button onClick={() => setSlip((x) => x.filter((y) => y.eventId !== s.eventId))} aria-label="Hiq"><i className="material-icons" style={{ fontSize: 18 }}>close</i></button>
                <span className="what">{s.pick === "over" || s.pick === "under" ? `${PICK_LABEL[s.pick]} ${s.point}` : `1x2: ${PICK_LABEL[s.pick]}`}</span>
                <span className="price">{s.odds.toFixed(2)}</span>
              </div>
            ))}
            {slip.length > 0 && (
              <>
                <div className="pl-field"><input inputMode="decimal" placeholder="Shuma e bastit (Lek)" value={stake} onChange={(e) => setStake(e.target.value)} /></div>
                <div className="pl-slip-sum">
                  <span>Kuota totale</span><strong>{slipOdds.toFixed(2)}</strong>
                  <span>Fitimi i mundshëm</span><strong>{fmtMoney(Number.isFinite(stakeNum) && stakeNum > 0 ? stakeNum * slipOdds : 0)} Lek</strong>
                  <span>Të disponueshme</span><span>{fmtMoney(funds)} Lek</span>
                </div>
                <button className="pl-btn" disabled={busy} onClick={submit}>{busy ? "Duke vendosur…" : "Vendos Bastin"}</button>
              </>
            )}
            {msg && <div className={msg.ok ? "pl-ok" : "pl-err"}>{msg.text}</div>}
          </div>
        </aside>
      </div>
    </PlayerShell>
  );
}

function SectionRows({ sec, isPicked, toggle }: {
  sec: { day: string; league: string; rows: MatchOdds[] };
  isPicked: (id: string, p: Pick) => boolean;
  toggle: (m: MatchOdds, p: Pick) => void;
}) {
  const cell = (m: MatchOdds, p: Pick) => {
    const price = priceFor(m, p);
    return (
      <td className="pl-odd">
        <button className={isPicked(m.id, p) ? "is-picked" : ""} disabled={!price} onClick={() => toggle(m, p)}>
          {price ? price.odds.toFixed(2) : "-"}
        </button>
      </td>
    );
  };
  return (
    <>
      <tr className="pl-day"><td colSpan={8}><i className="material-icons">calendar_month</i><strong>{sec.day}</strong>&nbsp;&nbsp;&nbsp;{sec.league}</td></tr>
      {sec.rows.map((m) => (
        <tr key={m.id} className="pl-match">
          <td className="pl-when">{timeOf(m.commenceTime)}<br />{shortCode(m.id)}</td>
          <td className="pl-teams">{m.home}<br />{m.away}</td>
          {cell(m, "home")}{cell(m, "draw")}{cell(m, "away")}
          <td className="pl-line">{m.totals ? m.totals.point.toFixed(1) : "-"}</td>
          {cell(m, "over")}{cell(m, "under")}
        </tr>
      ))}
    </>
  );
}
