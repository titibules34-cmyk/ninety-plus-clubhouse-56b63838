import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { createUserAsAdmin } from "@/lib/admin.functions";
import { MANAGER_ROLES, ROLE_LABELS, type AppRole } from "@/lib/roles";

type Props = {
  kind: "user" | "manager";
  parentId: string | null;
  parentName: string;
  onClose: () => void;
};

export function CreateAccountDialog({ kind, parentId, parentName, onClose }: Props) {
  const create = useServerFn(createUserAsAdmin);
  const qc = useQueryClient();
  const [role, setRole] = useState<AppRole>(kind === "manager" ? "menaxher" : "user");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk("");
    if (!username.trim()) return setErr("Shkruani përdoruesin");
    if (password.length < 6) return setErr("Fjalëkalimi duhet të ketë të paktën 6 karaktere");
    if (password !== confirm) return setErr("Fjalëkalimet nuk përputhen");
    setBusy(true);
    try {
      const r = await create({ data: { username, password, role, fullName: "", parentId } });
      if (r.ok) {
        setOk(`${ROLE_LABELS[role]} "${username.trim().toLowerCase()}" u krijua`);
        setUsername(""); setPassword(""); setConfirm("");
        qc.invalidateQueries({ queryKey: ["users"] });
      } else setErr(r.error);
    } catch {
      setErr("Përdoruesi: 3-32 shkronja, numra, . _ -");
    }
    setBusy(false);
  }

  return (
    <div className="dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dlg" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="dlg-title">
        <h2 id="dlg-title" className="dlg-title">{kind === "manager" ? "Tipi i Menaxherit:" : "Shto Përdorues:"}</h2>
        <div className="dlg-parent">
          <span className="dlg-parent-icon"><i className="material-icons">people</i></span>
          <span>{parentName}</span>
        </div>

        {kind === "manager" && (
          <div className="dlg-radios" role="radiogroup">
            {MANAGER_ROLES.map((r) => (
              <label key={r} className="dlg-radio">
                <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
                <span>{ROLE_LABELS[r]}</span>
              </label>
            ))}
          </div>
        )}

        <label className="dlg-field">
          <input placeholder=" " value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="off" />
          <span>Përdorues</span>
        </label>
        <label className="dlg-field">
          <input type="password" placeholder=" " value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <span>Fjalëkalim</span>
        </label>
        <label className="dlg-field">
          <input type="password" placeholder=" " value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          <span>Konfirmo Fjalëkalimin</span>
        </label>

        {err && <p className="dlg-msg dlg-msg-err">{err}</p>}
        {ok && <p className="dlg-msg dlg-msg-ok">{ok}</p>}

        <div className="dlg-actions">
          <button type="button" className="dlg-btn" onClick={onClose}>Mbyll</button>
          <button type="submit" className="dlg-btn dlg-btn-primary" disabled={busy}>Dërgo</button>
        </div>
      </form>
    </div>
  );
}
