import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { transferBalance } from "@/lib/transfer.functions";
import { parseAmount, type TransferKind } from "@/lib/transfer";
import { available } from "@/lib/hierarchy";

const fmt = (n: number) => Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Props = { targetId: string; onClose: () => void };

export function BalanceDialog({ targetId, onClose }: Props) {
  const qc = useQueryClient();
  const send = useServerFn(transferBalance);
  const [kind, setKind] = useState<TransferKind>("deposit");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: t } = useQuery({
    queryKey: ["profile", targetId],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", targetId).maybeSingle()).data,
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk("");
    const value = parseAmount(amount);
    if (value === null) return setErr("Shkruani një vlerë të vlefshme");
    setBusy(true);
    try {
      const r = await send({ data: { targetId, kind, amount: value, description } });
      if (r.ok) {
        setOk(`${kind === "deposit" ? "Depozitimi" : "Tërheqja"} prej ${fmt(value)} Lek u krye`);
        setAmount(""); setDescription("");
        await Promise.all([
          qc.invalidateQueries({ queryKey: ["profile"] }),
          qc.invalidateQueries({ queryKey: ["accounts"] }),
          qc.invalidateQueries({ queryKey: ["me"] }),
          qc.invalidateQueries({ queryKey: ["users"] }),
        ]);
      } else setErr(r.error);
    } catch {
      setErr("Veprimi nuk u krye");
    }
    setBusy(false);
  }

  const pick = (k: TransferKind) => { setKind(k); setErr(""); setOk(""); };

  return (
    <div className="dlg-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="dlg bal-dlg" onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="bal-title">
        <h2 id="bal-title" className="dlg-title">Vepro në Balancë: {t?.username ?? ""}</h2>
        <div className="bal-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={kind === "deposit"} className={kind === "deposit" ? "is-active" : ""} onClick={() => pick("deposit")}>Depozitime</button>
          <button type="button" role="tab" aria-selected={kind === "withdraw"} className={kind === "withdraw" ? "is-active" : ""} onClick={() => pick("withdraw")}>Tërheqje</button>
        </div>
        <dl className="bal-stats">
          <div><dt><i className="material-icons">account_balance</i>Balanca</dt><dd>{fmt(t?.balance ?? 0)} Lek</dd></div>
          <div><dt><i className="material-icons">schedule</i>Në Pritje</dt><dd>{fmt(t?.pending ?? 0)} Lek</dd></div>
          <div><dt><i className="material-icons">savings</i>Fondet E Disponueshme</dt><dd>{fmt(t ? available(t) : 0)} Lek</dd></div>
        </dl>
        <label className="dlg-field">
          <input inputMode="decimal" placeholder=" " value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus autoComplete="off" />
          <span>Vlera</span>
        </label>
        <label className="dlg-field">
          <input placeholder=" " value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} autoComplete="off" />
          <span>Përshkrimi</span>
        </label>
        {err && <p className="dlg-msg dlg-msg-err">{err}</p>}
        {ok && <p className="dlg-msg dlg-msg-ok">{ok}</p>}
        <div className="dlg-actions">
          <button type="button" className="dlg-btn" onClick={onClose}>Mbyll</button>
          <button type="submit" className="dlg-btn dlg-btn-primary" disabled={busy || !t}>Dërgo</button>
        </div>
      </form>
    </div>
  );
}
