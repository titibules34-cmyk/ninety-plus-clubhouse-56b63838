import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminShell } from "@/components/AdminShell";
import { useMe } from "@/lib/use-me";
import { available, hierarchyRows, STATUS_LABELS, toCsv, type Account, type AccountStatus, type SortKey } from "@/lib/hierarchy";

export const Route = createFileRoute("/_authenticated/balanca")({
  validateSearch: (s: Record<string, unknown>) => ({ u: typeof s["u"] === "string" ? (s["u"] as string) : undefined }),
  head: () => ({
    meta: [
      { title: "Balancë & Overdraft — 90Plus" },
      { name: "description", content: "Tabela e hierarkisë me balancat e përdoruesve." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Balanca,
});

const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const STATUSES: AccountStatus[] = ["aktiv", "bllokuar", "mbyllur"];

function Balanca() {
  const { u } = Route.useSearch();
  const { data: me } = useMe();
  const navigate = useNavigate();
  const rootId = u ?? me?.id;
  const { data: accounts } = useQuery({
    queryKey: ["accounts"],
    enabled: !!me,
    queryFn: async () =>
      ((await supabase.from("profiles").select("id, username, parent_id, balance, overdraft, pending, status")).data ?? []) as Account[],
  });
  const [mode, setMode] = useState<"direct" | "all">("direct");
  const [open, setOpen] = useState(true);
  const [statuses, setStatuses] = useState<Set<AccountStatus>>(new Set(STATUSES));
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "username", dir: 1 });

  const root = accounts?.find((a) => a.id === rootId);
  const rows = useMemo(
    () => (accounts && rootId ? hierarchyRows(accounts, rootId, mode, statuses, sort) : []),
    [accounts, rootId, mode, statuses, sort],
  );

  const toggleSort = (key: SortKey) => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }));
  const toggleStatus = (s: AccountStatus) =>
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s); else next.add(s);
      return next;
    });

  function download() {
    if (!root) return;
    const blob = new Blob(["\ufeff" + toCsv(root, rows)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `hierarkia-${root.username}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const sortIcon = (key: SortKey) => (
    <i className={`material-icons hier-sort${sort.key === key ? " is-active" : ""}`}>
      {sort.key === key && sort.dir === -1 ? "arrow_drop_down" : "arrow_drop_up"}
    </i>
  );

  return (
    <AdminShell>
      <section className="hier-head">
        <div className="hier-name">{root?.username ?? ""}</div>
        <label className="hier-select">
          <span>Zgjidh Valutën:</span>
          <select defaultValue="Lek"><option>Lek</option></select>
        </label>
      </section>

      <section className="hier-card">
        <div className="hier-toolbar">
          <h3>Tabela e Hierarkisë</h3>
          <label className="hier-select">
            <span>Paraqit:</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as "direct" | "all")}>
              <option value="direct">Vetëm Veten</option>
              <option value="all">Të Gjitha Nivelet</option>
            </select>
          </label>
          <button className="hier-download" onClick={download} aria-label="Shkarko" title="Shkarko">
            <i className="material-icons">file_download</i>
          </button>
        </div>

        <div className="hier-scroll">
          <table className="hier-table">
            <thead>
              <tr><th className="hier-user-col" /><th colSpan={4}>Lek</th></tr>
              <tr>
                <th className="hier-user-col"><button onClick={() => toggleSort("username")}>Përdorues {sortIcon("username")}</button></th>
                <th><button onClick={() => toggleSort("balance")}>Balanca {sortIcon("balance")}</button></th>
                <th><button onClick={() => toggleSort("overdraft")}>Overdrafti {sortIcon("overdraft")}</button></th>
                <th>Në Pritje</th>
                <th>Të Disponueshme</th>
              </tr>
            </thead>
            <tbody>
              {root && (
                <tr className="hier-root">
                  <td className="hier-user-col">
                    <div className="hier-root-cell">
                      <button onClick={() => setOpen((o) => !o)} aria-label={open ? "Mbyll" : "Hap"} className="hier-caret">
                        <i className="material-icons">{open ? "arrow_drop_down" : "arrow_right"}</i>
                      </button>
                      <span>{root.username}</span>
                      <Link to="/dashboard" search={{ u: root.id === me?.id ? undefined : root.id }} aria-label="Ndrysho" className="hier-edit">
                        <i className="material-icons">edit</i>
                      </Link>
                    </div>
                  </td>
                  <td>{fmt(root.balance)}</td>
                  <td>{fmt(root.overdraft)}</td>
                  <td>{fmt(root.pending)}</td>
                  <td>{fmt(available(root))}</td>
                </tr>
              )}
              {open && rows.map(({ account: a, depth }) => (
                <tr key={a.id} className={`hier-row is-${a.status}`}>
                  <td className="hier-user-col">
                    <button
                      className="hier-child"
                      style={{ paddingLeft: 10 + depth * 18 }}
                      onClick={() => navigate({ to: "/balanca", search: { u: a.id } })}
                    >
                      {a.username}
                    </button>
                  </td>
                  <td>{fmt(a.balance)}</td>
                  <td>{fmt(a.overdraft)}</td>
                  <td>{fmt(a.pending)}</td>
                  <td>{fmt(available(a))}</td>
                </tr>
              ))}
              {open && root && rows.length === 0 && (
                <tr><td colSpan={5} className="hier-empty">Nuk ka përdorues</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="hier-legend">
          {STATUSES.map((s) => (
            <label key={s} className={`hier-check is-${s}`}>
              <input type="checkbox" checked={statuses.has(s)} onChange={() => toggleStatus(s)} />
              <span>{STATUS_LABELS[s]}</span>
            </label>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
