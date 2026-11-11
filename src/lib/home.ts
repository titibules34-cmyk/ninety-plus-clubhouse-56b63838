import { MANAGER_ROLES } from "./roles";

/** Admins and managers land on their dashboard; players land on SPORT. */
export function homeFor(roles: readonly string[]): "/dashboard" | "/sport" {
  const staff = roles.includes("admin") || roles.some((r) => (MANAGER_ROLES as readonly string[]).includes(r));
  return staff ? "/dashboard" : "/sport";
}
