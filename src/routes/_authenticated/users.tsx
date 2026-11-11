import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { createUserAsAdmin } from "@/lib/admin.functions";
import { useMe } from "@/lib/use-me";
import { ALL_ROLES, ROLE_LABELS, type AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Përdoruesit — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Users,
});

function Users() {
  const { data: me } = useMe();
  const qc = useQueryClient();
  const create = useServerFn(createUserAsAdmin);
  const { data: users } = useQuery({
    queryKey: ["users"],
    enabled: !!me?.isAdmin,
    queryFn: async () => (await supabase.from("profiles").select("id, username, full_name, balance").order("created_at", { ascending: false })).data ?? [],
  });
  const [f, setF] = useState({ username: "", password: "", fullName: "", role: "user" as AppRole });
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const r = await create({ data: f });
      if (r.ok) { setMsg("Përdoruesi u krijua"); setF({ username: "", password: "", fullName: "", role: "user" }); qc.invalidateQueries({ queryKey: ["users"] }); }
      else setMsg(r.error);
    } catch (err) { setMsg(err instanceof Error ? err.message.replace(/^\[.*?\]\s*/, "") : "Gabim"); }
    setBusy(false);
  }

  if (me && !me.isAdmin) return <AdminShell><section className="adm-card"><h3>Nuk keni akses</h3></section></AdminShell>;

  return (
    <AdminShell>
      <div className="adm-title"><span>Përdoruesit</span></div>
      <section className="adm-card">
        <h3>Krijo Përdorues</h3>
        <form className="adm-form" onSubmit={submit}>
          <input className="adm-input" placeholder="Përdorues" value={f.username} onChange={(e) => setF({ ...f, username: e.target.value })} required />
          <input className="adm-input" placeholder="Fjalëkalim" type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required />
          <input className="adm-input" placeholder="Emër, Mbiemër" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
          <select className="adm-input" value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as AppRole })}>
            {ALL_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <button className="adm-btn" disabled={busy}>Krijo</button>
        </form>
        {msg && <p className="adm-err">{msg}</p>}
      </section>
      <section className="adm-card">
        <table className="adm-table">
          <thead><tr><th>Përdorues</th><th>Emër, Mbiemër</th><th>Balanca (Lek)</th></tr></thead>
          <tbody>
            {users?.map((u) => (
              <tr key={u.id}>
                <td><Link to="/dashboard" search={{ u: u.id }} className="adm-link">{u.username}</Link></td>
                <td>{u.full_name}</td>
                <td>{Number(u.balance).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  );
}
