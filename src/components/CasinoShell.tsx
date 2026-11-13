import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { PlayerShell, fmtMoney } from "@/components/PlayerShell";
import { myCasinoRounds } from "@/lib/casino.functions";
import { useMe } from "@/lib/use-me";
import { available } from "@/lib/hierarchy";

export type CasinoGame = "slots" | "roulette" | "blackjack" | "crash";
export const CHIPS = [10, 50, 100, 500, 1000];

export function useFunds() {
  const { data: me } = useMe();
  return me?.profile ? available(me.profile) : 0;
}

export function CasinoShell({ game, title, children }: { game: CasinoGame; title: string; children: ReactNode }) {
  const funds = useFunds();
  const fetchRounds = useServerFn(myCasinoRounds);
  const { data: rounds } = useQuery({ queryKey: ["casino-rounds", game], queryFn: () => fetchRounds({ data: { game } }) });
  return (
    <PlayerShell>
      <div className="cz-bar">
        <Link to="/kazino" className="cz-back"><i className="material-icons">arrow_back</i>Kazino</Link>
        <strong className="cz-title">{title}</strong>
        <span className="cz-funds">Të disponueshme <strong>{fmtMoney(funds)} Lek</strong></span>
      </div>
      <div className="cz-layout">
        <section className="cz-stage">{children}</section>
        <aside className="pl-box cz-history">
          <div className="pl-box-head">Lojërat e fundit</div>
          {!rounds?.length && <div className="pl-empty">Asnjë lojë ende</div>}
          {rounds?.map((r) => {
            const net = r.payout - r.stake;
            return (
              <div key={r.id} className="cz-hist-row">
                <span>{new Date(r.at).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <span>{fmtMoney(r.stake)}</span>
                <strong className={net > 0 ? "is-win" : net < 0 ? "is-loss" : ""}>{net > 0 ? "+" : ""}{fmtMoney(net)}</strong>
              </div>
            );
          })}
        </aside>
      </div>
    </PlayerShell>
  );
}

export function StakePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="cz-stake">
      <label>Shuma (Lek)</label>
      <input inputMode="decimal" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
      <div className="cz-chips">
        {CHIPS.map((c) => (
          <button key={c} type="button" disabled={disabled} onClick={() => onChange(String(c))}>{c}</button>
        ))}
      </div>
    </div>
  );
}

export const parseStake = (s: string) => Number(s.replace(",", "."));
