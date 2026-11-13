import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { CasinoShell, useFunds } from "@/components/CasinoShell";
import { fmtMoney } from "@/components/PlayerShell";
import { spinRoulette } from "@/lib/casino.functions";
import { WHEEL_ORDER, betKey, colorOf, type RouletteBet, type RouletteBetType } from "@/lib/casino/roulette";

export const Route = createFileRoute("/_authenticated/kazino/roulette")({
  head: () => ({ meta: [{ title: "Ruletë — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Roulette,
});

const SEG = 360 / 37;
const CHIP_VALUES = [1, 5, 10, 50, 100, 500];
const ROWS = [3, 2, 1].map((r) => Array.from({ length: 12 }, (_, c) => c * 3 + r));
const WHEEL_BG = `conic-gradient(${WHEEL_ORDER.map((n, i) => `var(--cz-${colorOf(n)}) ${i * SEG}deg ${(i + 1) * SEG}deg`).join(", ")})`;

function Roulette() {
  const spin = useServerFn(spinRoulette);
  const qc = useQueryClient();
  const funds = useFunds();
  const [chip, setChip] = useState(10);
  const [bets, setBets] = useState<Record<string, RouletteBet>>({});
  const [last, setLast] = useState<RouletteBet[]>([]);
  const [rot, setRot] = useState(0);
  const [result, setResult] = useState<number | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const total = Object.values(bets).reduce((s, b) => s + b.amount, 0);

  function place(type: RouletteBetType, value?: number) {
    if (busy) return;
    setMsg(null);
    const key = betKey({ type, value });
    setBets((b) => ({ ...b, [key]: { type, value, amount: (b[key]?.amount ?? 0) + chip } }));
  }
  const amt = (type: RouletteBetType, value?: number) => bets[betKey({ type, value })]?.amount;

  async function go() {
    const list = Object.values(bets);
    setMsg(null);
    if (!list.length) return setMsg({ ok: false, text: "Vendosni fiche në tavolinë" });
    if (total > funds) return setMsg({ ok: false, text: "Nuk keni fonde të mjaftueshme" });
    setBusy(true); setResult(null);
    try {
      const r = await spin({ data: { bets: list } });
      if (!r.ok) { setMsg({ ok: false, text: r.error }); setBusy(false); return; }
      const idx = WHEEL_ORDER.indexOf(r.number);
      const target = -(idx * SEG + SEG / 2);
      setRot((cur) => cur - (cur % 360) - 360 * 5 + target);
      await new Promise((res) => setTimeout(res, 4200));
      setResult(r.number);
      setRecent((x) => [r.number, ...x].slice(0, 12));
      setLast(list); setBets({});
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["casino-rounds", "roulette"] });
      setMsg(r.payout > 0 ? { ok: true, text: `${r.number} — fitove ${fmtMoney(r.payout)} Lek` } : { ok: false, text: `${r.number} — provo përsëri` });
    } catch {
      setMsg({ ok: false, text: "Loja nuk u krye" });
    }
    setBusy(false);
  }

  const Cell = ({ type, value, label, className = "" }: { type: RouletteBetType; value?: number; label: string; className?: string }) => {
    const a = amt(type, value);
    const hit = result != null && type === "straight" && value === result;
    return (
      <button className={`cz-rt-cell ${className} ${hit ? "is-hit" : ""}`} onClick={() => place(type, value)} disabled={busy}>
        {label}
        {a ? <span className="cz-chip-badge">{a}</span> : null}
      </button>
    );
  };

  return (
    <CasinoShell game="roulette" title="Ruletë">
      <div className="cz-rt-top">
        <div className="cz-wheel-wrap">
          <div className="cz-wheel-pointer" />
          <div className="cz-wheel" style={{ background: WHEEL_BG, transform: `rotate(${rot}deg)`, transition: busy ? "transform 4s cubic-bezier(.12,.8,.2,1)" : "none" }}>
            {WHEEL_ORDER.map((n, i) => (
              <span key={n} className="cz-wheel-num" style={{ transform: `rotate(${i * SEG + SEG / 2}deg) translateY(-118px)` }}>{n}</span>
            ))}
            <div className="cz-wheel-hub">{result ?? ""}</div>
          </div>
        </div>
        <div className="cz-rt-side">
          <div className="cz-recent">
            {recent.map((n, i) => <span key={i} className={`cz-ball is-${colorOf(n)}`}>{n}</span>)}
            {!recent.length && <span className="pl-empty">Numrat e fundit</span>}
          </div>
          <div className="cz-chip-pick">
            {CHIP_VALUES.map((c) => (
              <button key={c} className={`cz-chip ${chip === c ? "is-active" : ""}`} onClick={() => setChip(c)}>{c}</button>
            ))}
          </div>
          <div className="cz-rt-total">Totali i bastit: <strong>{fmtMoney(total)} Lek</strong></div>
          <div className="cz-rt-actions">
            <button className="cz-ghost" disabled={busy || !total} onClick={() => setBets({})}>Pastro</button>
            <button className="cz-ghost" disabled={busy || !last.length} onClick={() => setBets(Object.fromEntries(last.map((b) => [betKey(b), b])))}>Përsërit</button>
            <button className="pl-btn cz-go" disabled={busy} onClick={go}>{busy ? "Duke rrotulluar…" : "SPIN"}</button>
          </div>
          {msg && <div className={msg.ok ? "pl-ok cz-msg" : "pl-err cz-msg"}>{msg.text}</div>}
        </div>
      </div>

      <div className="cz-rt-table">
        <Cell type="straight" value={0} label="0" className="cz-rt-zero is-green" />
        <div className="cz-rt-numbers">
          {ROWS.map((row, r) => (
            <div key={r} className="cz-rt-row">
              {row.map((n) => <Cell key={n} type="straight" value={n} label={String(n)} className={`is-${colorOf(n)}`} />)}
              <Cell type="column" value={3 - r} label="2:1" />
            </div>
          ))}
          <div className="cz-rt-row">
            <Cell type="dozen" value={1} label="1 - 12" className="span4" />
            <Cell type="dozen" value={2} label="13 - 24" className="span4" />
            <Cell type="dozen" value={3} label="25 - 36" className="span4" />
            <span className="cz-rt-spacer" />
          </div>
          <div className="cz-rt-row">
            <Cell type="low" label="1 - 18" className="span2" />
            <Cell type="even" label="ÇIFT" className="span2" />
            <Cell type="red" label="KUQE" className="span2 is-red" />
            <Cell type="black" label="ZEZË" className="span2 is-black" />
            <Cell type="odd" label="TEK" className="span2" />
            <Cell type="high" label="19 - 36" className="span2" />
            <span className="cz-rt-spacer" />
          </div>
        </div>
      </div>
      <p className="cz-note">Numër i vetëm paguan 35:1 · Dyzinë/Kolonë 2:1 · Kuqe/Zezë, Çift/Tek, 1-18/19-36 paguajnë 1:1</p>
    </CasinoShell>
  );
}
