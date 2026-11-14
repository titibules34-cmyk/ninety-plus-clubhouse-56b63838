export type TransferKind = "deposit" | "withdraw";

/** Parses a typed amount ("1,000.50" or "1000,5"); returns null if not a positive amount with at most 2 decimals. */
export function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(/\s/g, "");
  if (!s) return null;
  const normalized = /,\d{1,2}$/.test(s) && !s.includes(".") ? s.replace(",", ".") : s.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const n = Number(normalized);
  return n > 0 && n <= 1_000_000_000 ? n : null;
}

const MESSAGES: Record<string, string> = {
  INSUFFICIENT_FUNDS: "Nuk keni fonde të mjaftueshme",
  TARGET_INSUFFICIENT: "Përdoruesi nuk ka fonde të mjaftueshme për tërheqje",
  FORBIDDEN: "Nuk keni leje për këtë përdorues",
  SAME_ACCOUNT: "Nuk mund të transferoni te vetja",
  BAD_AMOUNT: "Shkruani një vlerë të vlefshme",
  NO_ACCOUNT: "Llogaria nuk u gjet",
};

export function transferError(msg: string): string {
  const code = Object.keys(MESSAGES).find((k) => msg.includes(k));
  return code ? MESSAGES[code]! : "Veprimi nuk u krye";
}
