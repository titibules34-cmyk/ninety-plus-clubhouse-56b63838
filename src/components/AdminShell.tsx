import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/lib/use-me";
import { CreateAccountDialog } from "@/components/CreateAccountDialog";

export function AdminShell({ children }: { children: ReactNode }) {
  const { data: me } = useMe();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);
  const { data: results } = useQuery({
    queryKey: ["search", q],
    enabled: !!me?.isAdmin && q.trim().length > 0,
    queryFn: async () => (await supabase.from("profiles").select("id, username").ilike("username", `%${q.trim()}%`).limit(8)).data ?? [],
  });
  const name = me?.profile?.username ?? "";
  useEffect(() => {
    if (me && !me.isAdmin && !me.isManager) navigate({ to: "/sport", replace: true });
  }, [me, navigate]);
  const [dialog, setDialog] = useState<null | "user" | "manager">(null);
  // New accounts go under the account being viewed (dashboard ?u=), or under the signed-in admin.
  const viewedId = useRouterState({ select: (s) => (s.location.search as { u?: string }).u });
  const { data: viewed } = useQuery({
    queryKey: ["profile-name", viewedId],
    enabled: !!viewedId,
    queryFn: async () => (await supabase.from("profiles").select("id, username").eq("id", viewedId!).maybeSingle()).data,
  });
  const parent = viewed ?? (me ? { id: me.id, username: name } : null);

  async function signOut() {
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="adm">
      <header className="adm-top">
        <div className="adm-search">
          <i className="material-icons">search</i>
          <input placeholder="Kërko Përdorues/Menaxher" value={q} onChange={(e) => setQ(e.target.value)} />
          {q && <button onClick={() => setQ("")}><i className="material-icons">close</i></button>}
          {results && results.length > 0 && (
            <div className="adm-results">
              {results.map((r) => (
                <Link key={r.id} to="/dashboard" search={{ u: r.id }} onClick={() => setQ("")}>{r.username}</Link>
              ))}
            </div>
          )}
        </div>
        <nav className="adm-nav">
          <Link to="/balanca" search={{ u: undefined }} activeProps={{ className: "is-active" }} activeOptions={{ includeSearch: false }}>Balancë &amp; Overdraft</Link>
          <Link to="/biletat" search={{ kodi: undefined }} activeProps={{ className: "is-active" }} activeOptions={{ includeSearch: false }}>Biletat</Link>
          <Link to="/dashboard" search={{ u: undefined }} activeProps={{ className: "is-active" }} activeOptions={{ includeSearch: false }}>Llogaria</Link>
          <i className="material-icons">notifications</i>
          <i className="material-icons">email</i>
          <span>{name}</span>
          <div className="adm-menu-wrap">
            <button onClick={() => setMenu((m) => !m)} aria-label="Settings"><i className="material-icons">settings</i></button>
            {menu && <div className="adm-menu"><button onClick={signOut}>Dil (Logout)</button></div>}
          </div>
        </nav>
      </header>
      <aside className="adm-side">
        <Link to="/dashboard" search={{ u: undefined }} className="adm-avatar">{name.charAt(0).toUpperCase() || "A"}</Link>
        {me?.isAdmin && (
          <>
            <button type="button" onClick={() => setDialog("manager")} title="Shto Menaxher" aria-label="Shto Menaxher" className="adm-side-btn"><i className="material-icons">group_add</i></button>
            <button type="button" onClick={() => setDialog("user")} title="Shto Përdorues" aria-label="Shto Përdorues" className="adm-side-btn"><i className="material-icons">person_add</i></button>
            <Link to="/sport" title="Sport" aria-label="Sport" className="adm-side-btn"><i className="material-icons">sports_soccer</i></Link>
            <Link to="/users" title="Përdoruesit" aria-label="Përdoruesit" className="adm-side-btn"><i className="material-icons">list</i></Link>
          </>
        )}
      </aside>
      <main className="adm-main">{children}</main>
      {dialog && parent && (
        <CreateAccountDialog key={dialog} kind={dialog} parentId={parent.id} parentName={parent.username} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
