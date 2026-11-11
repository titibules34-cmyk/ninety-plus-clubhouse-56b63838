import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { useMe } from "@/lib/use-me";

export const Route = createFileRoute("/_authenticated/dashboard")({
  validateSearch: (s: Record<string, unknown>) => ({ u: typeof s["u"] === "string" ? (s["u"] as string) : undefined }),
  head: () => ({ meta: [{ title: "Llogaria — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Dashboard,
});

const CURRENCIES = ["EUR", "USD", "CHF", "CFA", "GBP", "CAD", "AUD", "ZAR", "AED", "HUF", "SEK"];
const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const FIELDS = [
  ["full_name", "Emër, Mbiemër:"],
  ["id_number", "Numri I Kartës Së Identitetit/Pasaportës:"],
  ["city", "Qyteti:"],
  ["address", "Adresa:"],
  ["phone", "Tel mob:"],
  ["email", "E-mail:"],
] as const;

function Dashboard() {
  const { u } = Route.useSearch();
  const { data: me } = useMe();
  const qc = useQueryClient();
  const targetId = u ?? me?.id;
  const { data: p } = useQuery({
    queryKey: ["profile", targetId],
    enabled: !!targetId,
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", targetId!).maybeSingle()).data,
  });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: "", id_number: "", city: "", address: "", phone: "", email: "", balance: "0", overdraft: "0", pending: "0" });
  const [err, setErr] = useState("");

  function startEdit() {
    if (!p) return;
    setForm({
      full_name: p.full_name, id_number: p.id_number, city: p.city, address: p.address, phone: p.phone, email: p.email,
      balance: String(p.balance), overdraft: String(p.overdraft), pending: String(p.pending),
    });
    setErr(""); setEditing(true);
  }
  async function save() {
    const nums = [form.balance, form.overdraft, form.pending].map(Number);
    if (nums.some((n) => Number.isNaN(n))) return setErr("Shumat duhet të jenë numra");
    const { error } = await supabase.from("profiles").update({
      full_name: form.full_name, id_number: form.id_number, city: form.city, address: form.address, phone: form.phone, email: form.email,
      balance: nums[0]!, overdraft: nums[1]!, pending: nums[2]!,
    }).eq("id", targetId!);
    if (error) return setErr("Nuk u ruajt");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["profile", targetId] });
    qc.invalidateQueries({ queryKey: ["me"] });
  }

  const available = p ? Number(p.balance) + Number(p.overdraft) - Number(p.pending) : 0;

  return (
    <AdminShell>
      <div className="adm-title"><span>{p?.username ?? ""}</span><i className="material-icons">settings</i></div>
      <section className="adm-card">
        <h3>Fondet</h3>
        <table className="adm-table">
          <thead><tr><th></th><th>Balanca</th><th>Overdrafti</th><th>Në Pritje</th><th>Të Disponueshme</th></tr></thead>
          <tbody>
            <tr><td>Lek</td>
              {editing ? ((["balance", "overdraft", "pending"] as const).map((k) => (
                <td key={k}><input className="adm-input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></td>
              ))) : (<><td>{fmt(p?.balance ?? 0)}</td><td>{fmt(p?.overdraft ?? 0)}</td><td>{fmt(p?.pending ?? 0)}</td></>)}
              <td>{fmt(available)}</td></tr>
            {CURRENCIES.map((c) => <tr key={c}><td>{c}</td><td className="plus">+</td><td className="plus">+</td><td className="plus">+</td><td></td></tr>)}
          </tbody>
        </table>
      </section>
      <section className="adm-card adm-card-top">
        <div className="adm-card-head">
          <h3>Të Dhënat e Përdoruesit</h3>
          {me?.isAdmin && !editing && <button onClick={startEdit} aria-label="Edit"><i className="material-icons">edit</i></button>}
          {editing && <div className="adm-actions"><button className="adm-btn" onClick={save}>Ruaj</button><button className="adm-btn ghost" onClick={() => setEditing(false)}>Anulo</button></div>}
        </div>
        {err && <p className="adm-err">{err}</p>}
        <div className="adm-details">
          {FIELDS.map(([k, label]) => (
            <div key={k} className="adm-row">
              <div className="adm-label">{label}</div>
              <div className="adm-value">{editing ? <input className="adm-input" value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /> : p?.[k]}</div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
