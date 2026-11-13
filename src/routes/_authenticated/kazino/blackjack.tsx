import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { CasinoShell, StakePicker, parseStake, useFunds } from "@/components/CasinoShell";
import { fmtMoney } from "@/components/PlayerShell";
import { bjAction, bjCurrent, bjDeal, type BjView } from "@/lib/casino.functions";
import { cardLabel, handValue, type Card } from "@/lib/casino/blackjack";

export const Route = createFileRoute("/_authenticated/kazino/blackjack")({
  head: () => ({ meta: [{ title: "Blackjack — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Blackjack,
});

const OUTCOME_TEXT = { blackjack: "BLACKJACK!", win: "Fitove", push: "Barazim", lose: "Humbe" } as const;

function CardView({ c, hidden }: { c?: Card; hidden?: boolean }) {
  if (hidden || c == null) return <div className="cz-card is-back" />;
  const l = cardLabel(c);
  return (
    <div className={`cz-card ${l.red ? "is-red" : ""}`}>
      <span className="tl">{l.rank}<br />{l.suit}</span>
      <span className="mid">{l.suit}</span>
    </div>
  );
}

function Blackjack() {
  const deal = useServerFn(bjDeal);
  const act = useServerFn(bjAction);
  const current = useServerFn(bjCurrent);
  const qc = useQueryClient();
  const funds = useFunds();
  const { data: resumed } = useQuery({ queryKey: ["bj-current"], queryFn: () => current(), staleTime: Infinity });
  const [view, setView] = useState<BjView | null>(null);
  const [stake, setStake] = useState("50");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (resumed && !view) setView(resumed); }, [resumed, view]);

  const open = view?.open ?? false;
  function after(v: BjView) {
    setView(v);
    if (!v.open) {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["casino-rounds", "blackjack"] });
    }
  }
  async function onDeal() {
    const s = parseStake(stake);
    setErr("");
    if (!Number.isFinite(s) || s < 1) return setErr("Vendosni shumën");
    if (s > funds) return setErr("Nuk keni fonde të mjaftueshme");
    setBusy(true);
    try {
      const r = await deal({ data: { stake: s } });
      if (r.ok) { after(r.view); qc.invalidateQueries({ queryKey: ["me"] }); } else setErr(r.error);
    } catch { setErr("Loja nuk u krye"); }
    setBusy(false);
  }
  async function onAction(action: "hit" | "stand" | "double") {
    setErr(""); setBusy(true);
    try {
      const r = await act({ data: { action } });
      if (r.ok) after(r.view); else setErr(r.error);
    } catch { setErr("Loja nuk u krye"); }
    setBusy(false);
  }

  const pv = view ? handValue(view.player).total : null;
  const dv = view && !view.open ? handValue(view.dealer).total : null;

  return (
    <CasinoShell game="blackjack" title="Blackjack">
      <div className="cz-felt">
        <div className="cz-hand">
          <span className="cz-hand-label">Dealer {dv != null && <b>{dv}</b>}</span>
          <div className="cz-cards">
            {view ? <>
              {view.dealer.map((c, i) => <CardView key={i} c={c} />)}
              {view.open && <CardView hidden />}
            </> : <><CardView hidden /><CardView hidden /></>}
          </div>
        </div>
        <div className="cz-felt-msg">
          {view?.outcome ? (
            <strong className={view.outcome === "lose" ? "is-loss" : "is-win"}>
              {OUTCOME_TEXT[view.outcome]}{view.payout ? ` · ${fmtMoney(view.payout)} Lek` : ""}
            </strong>
          ) : open ? <span>Basti: {fmtMoney(view!.stake)} Lek{view!.doubled ? " (dyfishuar)" : ""}</span> : <span>BLACKJACK PAGUAN 3:2 · DEALER QËNDRON NË 17</span>}
        </div>
        <div className="cz-hand">
          <div className="cz-cards">
            {view ? view.player.map((c, i) => <CardView key={i} c={c} />) : <><CardView hidden /><CardView hidden /></>}
          </div>
          <span className="cz-hand-label">Ti {pv != null && <b>{pv}</b>}</span>
        </div>
      </div>
      <div className="cz-controls">
        {open ? (
          <div className="cz-bj-actions">
            <button className="pl-btn" disabled={busy} onClick={() => onAction("hit")}>Letër (Hit)</button>
            <button className="pl-btn" disabled={busy} onClick={() => onAction("stand")}>Qëndro (Stand)</button>
            <button className="pl-btn" disabled={busy || !view?.canDouble || view.stake > funds} onClick={() => onAction("double")}>Dyfisho</button>
          </div>
        ) : (
          <>
            <StakePicker value={stake} onChange={setStake} disabled={busy} />
            <button className="pl-btn cz-go" disabled={busy} onClick={onDeal}>{busy ? "…" : "SHPËRNDAJ"}</button>
          </>
        )}
      </div>
      {err && <div className="pl-err cz-msg">{err}</div>}
    </CasinoShell>
  );
}
