import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isValidUsername, normalizeUsername, usernameToEmail } from "./username";
import { ALL_ROLES, type AppRole } from "./roles";

const creds = z.object({
  username: z.string().refine(isValidUsername, "Përdoruesi: 3-32 shkronja, numra, . _ -"),
  password: z.string().min(6, "Fjalëkalimi duhet të ketë të paktën 6 karaktere"),
});

function translateAuthError(msg: string) {
  if (/weak|easy to guess|pwned/i.test(msg)) return "Fjalëkalimi është shumë i dobët, zgjidhni një tjetër";
  if (/already/i.test(msg)) return "Ky përdorues ekziston tashmë";
  return "Përdoruesi nuk u krijua";
}

async function makeUser(username: string, password: string, role: AppRole, fullName = "", parentId: string | null = null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const uname = normalizeUsername(username);
  const { data: existing } = await supabaseAdmin.from("profiles").select("id").eq("username", uname).maybeSingle();
  if (existing) return { ok: false as const, error: "Ky përdorues ekziston tashmë" };
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: usernameToEmail(uname), password, email_confirm: true,
  });
  if (error || !data.user) return { ok: false as const, error: translateAuthError(error?.message ?? "") };
  const id = data.user.id;
  const p = await supabaseAdmin.from("profiles").insert({ id, username: uname, full_name: fullName, parent_id: parentId });
  const r = await supabaseAdmin.from("user_roles").insert({ user_id: id, role });
  if (p.error || r.error) {
    await supabaseAdmin.auth.admin.deleteUser(id);
    return { ok: false as const, error: "Përdoruesi nuk u ruajt" };
  }
  return { ok: true as const, id };
}

export const hasAnyAdmin = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
  return { exists: (count ?? 0) > 0 };
});

// Public, but only works while no admin exists yet (one-time setup).
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((d) => creds.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) > 0) return { ok: false as const, error: "Konfigurimi është kryer tashmë" };
    return makeUser(data.username, data.password, "admin");
  });

export const createUserAsAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    creds
      .extend({
        fullName: z.string().max(100).default(""),
        role: z.enum(ALL_ROLES).default("user"),
        parentId: z.string().uuid().nullable().default(null),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { ok: false as const, error: "Nuk keni leje" };
    return makeUser(data.username, data.password, data.role, data.fullName, data.parentId ?? context.userId);
  });
