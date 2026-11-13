import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CasinoShell, StakePicker, parseStake, useFunds } from "@/components/CasinoShell";
import { fmtMoney } from "@/components/PlayerShell";
import { spinSlots } from "@/lib/casino.functions";
import { STRIP, SYMBOL_ICON, THREE_OF_A_KIND, TWO_CHERRIES, SYMBOLS } from "@/lib/casino/slots";

export const Route = createFileRoute("/_authenticated/kazino/slots")({
  head: () => ({ meta: [{ title: "Slots — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Slots,
});

const N = STRIP.length;
const CELL = 96;
const REPEAT = 10;
const REEL = Array.from({ length: N * REPEAT }, (_, i) => STRIP[i % N]!);

function Slots() {
  const spin = useServerFn(spinSlots);
  const qc = useQueryClient();
  const funds = useFunds();
  const [stake, setStake] = useState("10");
  const [pos, setPos] = useState([N + 1, N + 5, N + 9]);
  const [animate, setAnimate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [win, setWin] = useState(false);

  async function go() {
    const s = parseStake(stake);
    setMsg(null); setWin(false);
    if (!Number.isFinite(s) || s < 1) return setMsg({ ok: false, text: "Vendosni shumën" });
    if (s > funds) return setMsg({ ok: false, text: "Nuk keni fonde të mjaftueshme" });
    setBusy(true);
    try {
      const r = await spin({ data: { stake: s } });
      if (!r.ok) { setMsg({ ok: false, text: r.error }); setBusy(false); return; }
      // Jump back to the first copies of the strip without animation, then roll forward to the result.
      const base = pos.map((p) => (p % N) + N);
      setAnimate(false); setPos(base);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      setAnimate(true);
      setPos(base.map((b, i) => b + N * (3 + i) + ((r.stops[i]! - (b % N) + N) % N)));
      await new Promise((res) => setTimeout(res, 2600));
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["casino-rounds", "slots"] });
      if (r.payout > 0) { setWin(true); setMsg({ ok: true, text: `Fitove ${fmtMoney(r.payout)} Lek (${r.mult}x)` }); }
      else setMsg({ ok: false, text: "Provo përsëri" });
    } catch {
      setMsg({ ok: false, text: "Loja nuk u krye" });
    }
    setBusy(false);
  }

  return (
    <CasinoShell game="slots" title="Slots">
      <div className={`cz-slot ${win ? "is-win" : ""}`}>
        <div className="cz-reels">
          {pos.map((p, i) => (
            <div key={i} className="cz-reel" style={{ height: CELL * 3 }}>
              <div className="cz-reel-strip" style={{ transform: `translateY(${-(p - 1) * CELL}px)`, transition: animate ? `transform ${1.6 + i * 0.45}s cubic-bezier(.15,.85,.25,1)` : "none" }}>
                {REEL.map((s, k) => <div key={k} className="cz-sym" style={{ height: CELL }}>{SYMBOL_ICON[s]}</div>)}
              </div>
            </div>
          ))}
          <div className="cz-payline" />
        </div>
        <div className="cz-controls">
          <StakePicker value={stake} onChange={setStake} disabled={busy} />
          <button className="pl-btn cz-go" disabled={busy} onClick={go}>{busy ? "Duke rrotulluar…" : "SPIN"}</button>
        </div>
        {msg && <div className={msg.ok ? "pl-ok cz-msg" : "pl-err cz-msg"}>{msg.text}</div>}
      </div>
      <div className="pl-box cz-paytable">
        <div className="pl-box-head">Tabela e pagesave (në vijën e mesit)</div>
        <div className="cz-pay-grid">
          {[...SYMBOLS].reverse().map((s) => (
            <div key={s}><span>{SYMBOL_ICON[s]}{SYMBOL_ICON[s]}{SYMBOL_ICON[s]}</span><strong>{THREE_OF_A_KIND[s]}x</strong></div>
          ))}
          <div><span>{SYMBOL_ICON.cherry}{SYMBOL_ICON.cherry} çdo vend</span><strong>{TWO_CHERRIES}x</strong></div>
        </div>
      </div>
    </CasinoShell>
  );
}
