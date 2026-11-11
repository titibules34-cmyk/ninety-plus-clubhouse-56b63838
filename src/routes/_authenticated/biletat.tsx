import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { PlayerShell, fmtMoney } from "@/components/PlayerShell";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/biletat")({
  validateSearch: (s: Record<string, unknown>) => ({ kodi: typeof s["kodi"] === "string" && s["kodi"] ? (s["kodi"] as string) : undefined }),
  head: () => ({ meta: [{ title: "Biletat — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Tickets,
});

const STATUS: Record<string, string> = { pending: "Në pritje", won: "Fituese", lost: "Humbëse", void: "Anuluar" };
const PICK: Record<string, string> = { home: "1", draw: "X", away: "2", over: "Lart", under: "Poshtë" };
const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

function Tickets() {
  const { kodi } = Route.useSearch();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const staff = !!(me?.isAdmin || me?.isManager);
  const [open, setOpen] = useState<string | null>(kodi ?? null);
  const [code, setCode] = useState(kodi ?? "");

  const { data: bets, isLoading } = useQuery({
    queryKey: ["bets", kodi ?? ""],
    enabled: !!me,
    queryFn: async () => {
      let q = supabase.from("bets").select("*, profiles(username), bet_selections(*)").order("created_at", { ascending: false }).limit(200);
      if (kodi) q = q.eq("code", kodi);
      return (await q).data ?? [];
    },
  });

  const body = (
    <section className={staff ? "adm-card" : "pl-page"}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, flex: 1 }}>{kodi ? `Bileta ${kodi}` : staff ? "Biletat" : "Biletat e mia"}</h3>
        <input
          className={staff ? "adm-input" : undefined}
          style={staff ? { maxWidth: 240 } : { background: "var(--pl-bg)", border: "1px solid var(--pl-line)", padding: 8, color: "var(--pl-text)" }}
          placeholder="Kodi i biletës" value={code} onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && navigate({ to: "/biletat", search: { kodi: code.trim() || undefined } })}
        />
        {kodi && <button className={staff ? "adm-btn ghost" : "pl-btn"} style={staff ? undefined : { width: "auto", margin: 0, fontSize: 15 }} onClick={() => { setCode(""); navigate({ to: "/biletat", search: { kodi: undefined } }); }}>Të gjitha</button>}
      </div>
      <table className={staff ? "adm-table adm-tickets" : "pl-tickets"}>
        <thead>
          <tr>
            <th>Kodi</th><th>Data</th>{staff && <th>Përdorues</th>}<th>Ndeshje</th><th>Shuma</th><th>Kuota</th><th>Fitimi i mundshëm</th><th>Statusi</th>
          </tr>
        </thead>
        <tbody>
          {isLoading && <tr><td colSpan={8}>Duke ngarkuar…</td></tr>}
          {!isLoading && !bets?.length && <tr><td colSpan={8}>{kodi ? "Bileta nuk u gjet" : "Nuk ka bileta"}</td></tr>}
          {bets?.map((b) => (
            <Fragment key={b.id}>
              <tr>
                <td><button className="code" style={{ cursor: "pointer", fontWeight: 700 }} onClick={() => setOpen((o) => (o === b.id || o === b.code ? null : b.id))}>{b.code}</button></td>
                <td>{when(b.created_at)}</td>
                {staff && <td>{b.profiles?.username}</td>}
                <td>{b.bet_selections.length}</td>
                <td>{fmtMoney(b.stake)}</td>
                <td>{Number(b.total_odds).toFixed(2)}</td>
                <td>{fmtMoney(b.status === "won" || b.status === "void" ? b.payout : b.potential_win)}</td>
                <td className={b.status}><span className={`pl-status is-${b.status}`}>{STATUS[b.status]}</span></td>
              </tr>
              {(open === b.id || open === b.code) && b.bet_selections.map((s) => (
                <tr key={s.id} className="sub">
                  <td />
                  <td>{when(s.commence_time)}</td>
                  {staff && <td />}
                  <td colSpan={2}>{s.home_team} - {s.away_team}<br /><small>{s.sport_title}</small></td>
                  <td>{s.market === "totals" ? `${PICK[s.pick]} ${s.point}` : `1x2: ${PICK[s.pick]}`} @ {Number(s.odds).toFixed(2)}</td>
                  <td>{s.home_score != null ? `${s.home_score} - ${s.away_score}` : ""}</td>
                  <td className={s.result}><span className={`pl-status is-${s.result}`}>{STATUS[s.result]}</span></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  );

  return staff ? <AdminShell>{body}</AdminShell> : <PlayerShell>{body}</PlayerShell>;
}
