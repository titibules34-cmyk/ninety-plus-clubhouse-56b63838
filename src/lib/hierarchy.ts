export type AccountStatus = "aktiv" | "bllokuar" | "mbyllur";

export type Account = {
  id: string;
  username: string;
  parent_id: string | null;
  balance: number;
  overdraft: number;
  pending: number;
  status: AccountStatus;
};

export const STATUS_LABELS: Record<AccountStatus, string> = {
  aktiv: "Aktiv",
  bllokuar: "E Bllokuar",
  mbyllur: "I Mbyllur",
};

export const available = (a: Pick<Account, "balance" | "overdraft" | "pending">) =>
  Number(a.balance) + Number(a.overdraft) - Number(a.pending);

export type SortKey = "username" | "balance" | "overdraft";

/** Rows under `rootId`: direct children only, or every level with its depth. */
export function hierarchyRows(
  all: Account[],
  rootId: string,
  mode: "direct" | "all",
  statuses: Set<AccountStatus>,
  sort: { key: SortKey; dir: 1 | -1 },
): { account: Account; depth: number }[] {
  const byParent = new Map<string, Account[]>();
  for (const a of all) {
    if (!a.parent_id) continue;
    const list = byParent.get(a.parent_id) ?? [];
    list.push(a);
    byParent.set(a.parent_id, list);
  }
  const cmp = (x: Account, y: Account) => {
    const v = sort.key === "username" ? x.username.localeCompare(y.username) : Number(x[sort.key]) - Number(y[sort.key]);
    return v * sort.dir;
  };
  const out: { account: Account; depth: number }[] = [];
  const seen = new Set<string>([rootId]);
  const walk = (parentId: string, depth: number) => {
    for (const child of [...(byParent.get(parentId) ?? [])].sort(cmp)) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      if (statuses.has(child.status)) out.push({ account: child, depth });
      if (mode === "all") walk(child.id, depth + 1);
    }
  };
  walk(rootId, 0);
  return out;
}

export function toCsv(root: Account, rows: { account: Account; depth: number }[]) {
  const head = ["Përdorues", "Balanca", "Overdrafti", "Në Pritje", "Të Disponueshme", "Statusi"];
  const line = (a: Account, prefix = "") =>
    [prefix + a.username, a.balance, a.overdraft, a.pending, available(a).toFixed(2), STATUS_LABELS[a.status]]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  return [head.join(","), line(root), ...rows.map((r) => line(r.account, "  ".repeat(r.depth + 1)))].join("\n");
}
