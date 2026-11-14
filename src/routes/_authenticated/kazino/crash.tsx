import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { CasinoShell, StakePicker, parseStake, useFunds } from "@/components/CasinoShell";
import { fmtMoney } from "@/components/PlayerShell";
import { crashCashout, crashCurrent, crashStart, type CrashView } from "@/lib/casino.functions";
import { multiplierAt } from "@/lib/casino/crash";

export const Route = createFileRoute("/_authenticated/kazino/crash")({
  head: () => ({ meta: [{ title: "Aviator — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Crash,
});

const W = 800, H = 340;

function Crash() {
  const start = useServerFn(crashStart);
  const cashout = useServerFn(crashCashout);
  const current = useServerFn(crashCurrent);
  const qc = useQueryClient();
  const funds = useFunds();
  const { data: resumed } = useQuery({ queryKey: ["crash-current"], queryFn: () => current(), staleTime: Infinity });

  const [view, setView] = useState<CrashView | null>(null);
  const [offset, setOffset] = useState(0); // server clock minus browser clock
  const [stake, setStake] = useState("50");
  const [auto, setAuto] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState<number[]>([]);
  const settledRef = useRef<string>("");

  function apply(v: CrashView | null) {
    if (!v) return;
    if (v.status === "running") setOffset(v.serverNow - Date.now());
    setView(v);
    if (v.status !== "running") {
      const key = `${v.crashAt}-${v.stake}-${v.status}`;
      if (settledRef.current !== key) {
        settledRef.current = key;
        setHistory((h) => [v.crashAt, ...h].slice(0, 14));
        qc.invalidateQueries({ queryKey: ["me"] });
        qc.invalidateQueries({ queryKey: ["casino-rounds", "crash"] });
      }
    }
  }
  useEffect(() => { if (resumed && !view) apply(resumed); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [resumed]);

  const running = view?.status === "running";
  // Animate locally; the server decides when the plane goes down.
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const tick = () => { setNow(Date.now()); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const poll = setInterval(async () => {
      try { apply(await current()); } catch { /* keep animating */ }
    }, 700);
    return () => { cancelAnimationFrame(raf); clearInterval(poll); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  async function onStart() {
    const s = parseStake(stake);
    const a = auto.trim() ? Number(auto.replace(",", ".")) : null;
    setErr("");
    if (!Number.isFinite(s) || s < 1) return setErr("Vendosni shumën");
    if (s > funds) return setErr("Nuk keni fonde të mjaftueshme");
    if (a != null && (!Number.isFinite(a) || a < 1.01)) return setErr("Auto-tërheqja duhet të jetë të paktën 1.01x");
    setBusy(true);
    try {
      const r = await start({ data: { stake: s, auto: a } });
      if (r.ok) { apply(r.view); qc.invalidateQueries({ queryKey: ["me"] }); } else setErr(r.error);
    } catch { setErr("Loja nuk u nis"); }
    setBusy(false);
  }
  async function onCashout() {
    setBusy(true);
    try {
      const r = await cashout();
      if (r.ok) apply(r.view); else setErr(r.error);
    } catch { setErr("Tërheqja dështoi"); }
    setBusy(false);
  }

  const serverNow = now + offset;
  let mult = 1, countdown = 0;
  if (view?.status === "running") {
    countdown = Math.max(0, view.startedAt - serverNow);
    mult = multiplierAt(serverNow - view.startedAt);
  } else if (view?.status === "won") mult = view.cashedAt;
  else if (view?.status === "lost") mult = view.crashAt;

  // Curve: x = time, y = multiplier, both scaled to keep the plane on screen.
  const elapsed = view?.status === "running" ? Math.max(0, serverNow - view.startedAt) : 0;
  const span = Math.max(10_000, elapsed * 1.15);
  const topM = Math.max(2, mult * 1.25);
  const pts: string[] = [];
  const steps = 60;
  const endT = view?.status === "running" ? elapsed : 0;
  for (let i = 0; i <= steps; i++) {
    const t = (endT * i) / steps;
    const m = Math.exp(0.07 * t / 1000);
    pts.push(`${(t / span) * W},${H - ((m - 1) / (topM - 1)) * (H - 30)}`);
  }
  const last = pts[pts.length - 1]!.split(",").map(Number);
  const crashed = view?.status === "lost";

  return (
    <CasinoShell game="crash" title="Aviator">
      <div className="cz-crash-hist">
        {history.map((c, i) => <span key={i} className={c >= 2 ? "is-high" : ""}>{c.toFixed(2)}x</span>)}
      </div>
      <div className={`cz-sky ${crashed ? "is-crashed" : ""}`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cz-sky-svg">
          {running && countdown === 0 && <>
            <polygon points={`0,${H} ${pts.join(" ")} ${last[0]},${H}`} className="cz-sky-fill" />
            <polyline points={pts.join(" ")} className="cz-sky-line" />
          </>}
        </svg>
        {running && countdown === 0 && (
          <i className="material-icons cz-plane" style={{ left: `${(last[0]! / W) * 100}%`, top: `${(last[1]! / H) * 100}%` }}>flight</i>
        )}
        <div className="cz-mult">
          {running && countdown > 0 ? <span className="cz-count">Nis për {(countdown / 1000).toFixed(1)}s</span> : (
            <>
              <strong>{mult.toFixed(2)}x</strong>
              {view?.status === "lost" && <span className="is-loss">RA! Humbe {fmtMoney(view.stake)} Lek</span>}
              {view?.status === "won" && <span className="is-win">Tërhoqe në {view.cashedAt.toFixed(2)}x · +{fmtMoney(view.payout)} Lek (ra në {view.crashAt.toFixed(2)}x)</span>}
              {!view && <span>Vendos bastin dhe nis fluturimin</span>}
            </>
          )}
        </div>
      </div>
      <div className="cz-controls">
        {running ? (
          <button className="pl-btn cz-go cz-cashout" disabled={busy || countdown > 0} onClick={onCashout}>
            TËRHIQ {fmtMoney(view.stake * mult)} Lek
          </button>
        ) : (
          <>
            <StakePicker value={stake} onChange={setStake} disabled={busy} />
            <div className="cz-stake">
              <label>Auto-tërheqje (x)</label>
              <input inputMode="decimal" placeholder="p.sh. 2.00" value={auto} disabled={busy} onChange={(e) => setAuto(e.target.value)} />
            </div>
            <button className="pl-btn cz-go" disabled={busy} onClick={onStart}>LUAJ</button>
          </>
        )}
      </div>
      {err && <div className="pl-err cz-msg">{err}</div>}
    </CasinoShell>
  );
}
