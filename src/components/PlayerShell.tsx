import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { available } from "@/lib/hierarchy";

const TABS = [
  { to: "/sport", label: "SPORT" },
  { to: "/live", label: "LIVE" },
  { to: "/gara-bingo-keno", label: "GARA-BINGO-KENO" },
  { to: "/rng-games", label: "RNG GAMES" },
  { to: "/kazino", label: "KAZINO" },
  { to: "/virtuals", label: "VIRTUALS" },
  { to: "/spin2win", label: "GAME_SPIN2WIN" },
] as const;

export const fmtMoney = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-GB"));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span>{now}</span>;
}

export function PlayerShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [menu, setMenu] = useState(false);
  const p = me?.profile;

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="pl">
      <header className="pl-top">
        <nav className="pl-tabs">
          {TABS.map((t) => (
            <Link key={t.to} to={t.to} activeProps={{ className: "is-active" }}>{t.label}</Link>
          ))}
        </nav>
        <div className="pl-right">
          <div className="pl-user">
            <button onClick={() => setMenu((m) => !m)}>{p?.username ?? ""}<i className="material-icons">arrow_drop_down</i></button>
            {menu && (
              <div className="pl-menu" onMouseLeave={() => setMenu(false)}>
                <div className="pl-menu-bal">Të Disponueshme<strong>{p ? fmtMoney(available(p)) : "0.00"} Lek</strong></div>
                <Link to="/biletat" search={{ kodi: undefined }}>Biletat e mia</Link>
                {(me?.isAdmin || me?.isManager) && <Link to="/dashboard" search={{ u: undefined }}>Paneli i administrimit</Link>}
                <button onClick={signOut}>Dil (Logout)</button>
              </div>
            )}
          </div>
          <Clock />
          <span>Shqip <i className="material-icons" style={{ verticalAlign: "middle", fontSize: 20 }}>arrow_drop_down</i></span>
          <i className="material-icons">forum</i>
          <i className="material-icons">settings</i>
        </div>
      </header>
      {children}
    </div>
  );
}

export function ComingSoon({ title }: { title: string }) {
  return (
    <PlayerShell>
      <div className="pl-soon">
        <i className="material-icons">construction</i>
        <strong>{title}</strong>
        <span>Së shpejti</span>
      </div>
    </PlayerShell>
  );
}
