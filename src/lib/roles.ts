export const MANAGER_ROLES = ["menaxher", "nen_menaxher", "menaxher_fundor"] as const;
export const ALL_ROLES = ["admin", "user", ...MANAGER_ROLES] as const;
export type AppRole = (typeof ALL_ROLES)[number];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  user: "Përdorues",
  menaxher: "Menaxher",
  nen_menaxher: "Nën-Menaxher",
  menaxher_fundor: "Menaxher-Fundor",
};
