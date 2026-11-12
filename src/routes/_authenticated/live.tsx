import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { PlayerShell, fmtMoney } from "@/components/PlayerShell";
import { getLiveMatches, placeBet } from "@/lib/sport.functions";
import { MAX_PICKS, MIN_STAKE, priceFor, totalOdds, type MatchOdds, type Pick, type SlipPick } from "@/lib/odds";
import { useMe } from "@/lib/use-me";
import { available } from "@/lib/hierarchy";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({ meta: [{ title: "LIVE — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Live,
});

const GROUPS: Record<string, { label: string; icon: string }> = {
  Soccer: { label: "Futboll", icon: "sports_soccer" },
  Basketball: { label: "Basketboll", icon: "sports_basketball" },
  Tennis: { label: "Tenis", icon: "sports_tennis" },
  "Ice Hockey": { label: "Hokej", icon: "sports_hockey" },
  "American Football": { label: "Futboll Amerikan", icon: "sports_football" },
  "Aussie Rules": { label: "Aussie Rules", icon: "sports_rugby" },
  "Rugby Union": { label: "Rugby Union", icon: "sports_rugby" },
  "Rugby League": { label: "Rugby League", icon: "sports_rugby" },
  Baseball: { label: "Bejsboll", icon: "sports_baseball" },
  Cricket: { label: "Kriket", icon: "sports_cricket" },
  Boxing: { label: "Boks", icon: "sports_mma" },
  "Mixed Martial Arts": { label: "MMA", icon: "sports_kabaddi" },
};
const PICK_LABEL: Record<Pick, string> = { home: "1", draw: "X", away: "2", over: "Lart", under: "Poshtë" };
type LiveMatch = MatchOdds & { group: string };

const minutesIn = (iso: string, now: number) => Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));

function Live() {
  const fetchLive = useServerFn(getLiveMatches);
  const doPlace = useServerFn(placeBet);
  const qc = useQueryClient();
  const { data: me } = useMe();

  // Prices are refreshed on the server at most once a minute; poll every 30s to pick that up.
  const { data, isLoading } = useQuery({ queryKey: ["live"], queryFn: () => fetchLive(), refetchInterval: 30_000, staleTime: 20_000 });
  const all = (data?.matches ?? []) as LiveMatch[];
  const scores = data?.scores ?? {};
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(t); }, []);

  const groups = useMemo(() => {
    const count = new Map<string, number>();
    for (const m of all) count.set(m.group, (count.get(m.group) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => (a[0] === "Soccer" ? -1 : b[0] === "Soccer" ? 1 : b[1] - a[1]));
  }, [all]);
  const [group, setGroup] = useState<string>("");
  const activeGroup = groups.some(([g]) => g === group) ? group : (groups[0]?.[0] ?? "");
  const [q, setQ] = useState("");

  const sections = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const rows = all
      .filter((m) => m.group === activeGroup)
      .filter((m) => !needle || m.home.toLowerCase().includes(needle) || m.away.toLowerCase().includes(needle))
      .sort((a, b) => a.sportTitle.localeCompare(b.sportTitle) || a.commenceTime.localeCompare(b.commenceTime));
    const out: { league: string; rows: LiveMatch[] }[] = [];
    for (const m of rows) {
      const last = out[out.length - 1];
      if (last?.league === m.sportTitle) last.rows.push(m);
      else out.push({ league: m.sportTitle, rows: [m] });
    }
    return out;
  }, [all, activeGroup, q]);

  // Betslip
  const [slip, setSlip] = useState<SlipPick[]>([]);
  const [stake, setStake] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function toggle(m: MatchOdds, pick: Pick) {
    const price = priceFor(m, pick);
    if (!price) return;
    setMsg(null);
    setSlip((s) => {
      const existing = s.find((x) => x.eventId === m.id);
      if (existing?.pick === pick) return s.filter((x) => x.eventId !== m.id);
      if (!existing && s.length >= MAX_PICKS) return s;
      const item: SlipPick = { eventId: m.id, sportKey: m.sportKey, sportTitle: m.sportTitle, home: m.home, away: m.away, commenceTime: m.commenceTime, pick, odds: price.odds, point: price.point, live: true };
      return existing ? s.map((x) => (x.eventId === m.id ? item : x)) : [...s, item];
    });
  }
  const isPicked = (id: string, pick: Pick) => slip.some((x) => x.eventId === id && x.pick === pick);

  // Keep slip prices in sync; drop picks whose game is no longer offered live.
  useEffect(() => {
    if (!data) return;
    setSlip((s) => {
      let changed = false;
      const next: SlipPick[] = [];
      for (const x of s) {
        const m = all.find((mm) => mm.id === x.eventId);
        const p = m && priceFor(m, x.pick);
        if (!p) { changed = true; continue; }
        if (p.odds !== x.odds || p.point !== x.point) { changed = true; next.push({ ...x, odds: p.odds, point: p.point }); }
        else next.push(x);
      }
      return changed ? next : s;
    });
  }, [data, all]);

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
      const r = await doPlace({ data: { stake: stakeNum, picks: slip.map((s) => ({ eventId: s.eventId, sportKey: s.sportKey, pick: s.pick, odds: s.odds, live: true })) } });
      if (r.ok) {
        setSlip([]); setStake("");
        setMsg({ ok: true, text: `Basti u vendos. Kodi i biletës: ${r.code}` });
        qc.invalidateQueries({ queryKey: ["me"] });
      } else {
        setMsg({ ok: false, text: r.error });
        if ("changed" in r && r.changed) await qc.invalidateQueries({ queryKey: ["live"] });
      }
    } catch {
      setMsg({ ok: false, text: "Basti nuk u vendos" });
    }
    setBusy(false);
  }

  const groupLabel = GROUPS[activeGroup]?.label ?? activeGroup;
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
    <PlayerShell>
      <div className="pl-sports">
        {groups.map(([g, n]) => (
          <button key={g} className={`pl-sport ${g === activeGroup ? "is-active" : ""}`} onClick={() => setGroup(g)}>
            <i className="material-icons">{GROUPS[g]?.icon ?? "emoji_events"}</i>
            {GROUPS[g]?.label ?? g} ({n})
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
          <div className="pl-box-head">Live tani</div>
          <div className="pl-leagues">
            {isLoading && <div className="pl-empty">Duke ngarkuar…</div>}
            {groups.map(([g, n]) => (
              <button key={g} className="pl-league" style={{ width: "100%", textAlign: "left", cursor: "pointer", fontWeight: g === activeGroup ? 700 : 400 }} onClick={() => setGroup(g)}>
                <span>{GROUPS[g]?.label ?? g} — {n} ndeshje</span>
              </button>
            ))}
          </div>
        </aside>

        <section className="pl-box">
          <table className="pl-odds-table">
            <colgroup>
              <col style={{ width: 100 }} /><col /><col style={{ width: 70 }} />
              <col style={{ width: "8%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} /><col style={{ width: "8%" }} /><col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th className="title" colSpan={3}>LIVE {groupLabel && `— ${groupLabel}`}</th>
                <th colSpan={3}>1x2<div className="sub"><span>1</span><span>X</span><span>2</span></div></th>
                <th colSpan={3}>TG_L/P<div className="sub"><span>sbv</span><span>Lart</span><span>Poshtë</span></div></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} className="pl-empty">Duke ngarkuar ndeshjet live…</td></tr>}
              {data?.error && <tr><td colSpan={9} className="pl-err">{data.error}</td></tr>}
              {!isLoading && !data?.error && sections.length === 0 && <tr><td colSpan={9} className="pl-empty">Nuk ka ndeshje live tani</td></tr>}
              {sections.map((sec) => (
                <SectionBlock key={sec.league} league={sec.league}>
                  {sec.rows.map((m) => {
                    const sc = scores[m.id];
                    return (
                      <tr key={m.id} className="pl-match">
                        <td className="pl-when"><span style={{ color: "var(--pl-live, var(--destructive))" }}>● LIVE</span><br />{minutesIn(m.commenceTime, now)}'</td>
                        <td className="pl-teams">{m.home}<br />{m.away}</td>
                        <td style={{ textAlign: "center", fontWeight: 700, fontSize: 18, lineHeight: 1.4, color: "var(--pl-odd)" }}>{sc ? <>{sc.home}<br />{sc.away}</> : "-"}</td>
                        {cell(m, "home")}{cell(m, "draw")}{cell(m, "away")}
                        <td className="pl-line">{m.totals ? m.totals.point.toFixed(1) : "-"}</td>
                        {cell(m, "over")}{cell(m, "under")}
                      </tr>
                    );
                  })}
                </SectionBlock>
              ))}
            </tbody>
          </table>
        </section>

        <aside>
          <div className="pl-box">
            <div className="pl-box-head">
              <span>Betslip Live<span className="pl-count">{slip.length}</span></span>
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

function SectionBlock({ league, children }: { league: string; children: ReactNode }) {
  return (
    <>
      <tr className="pl-day"><td colSpan={9}><i className="material-icons">sensors</i><strong>{league}</strong></td></tr>
      {children}
    </>
  );
}
