import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { transferError } from "./transfer";

const input = z.object({
  targetId: z.string().uuid(),
  kind: z.enum(["deposit", "withdraw"]),
  amount: z.number().positive().max(1_000_000_000),
  description: z.string().max(200).default(""),
});

/** Admins and upline managers move money between their own balance and a downline account. */
export const transferBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => input.parse(d))
  .handler(async ({ data, context }) => {
    if (data.targetId === context.userId) return { ok: false as const, error: transferError("SAME_ACCOUNT") };
    const [{ data: isAdmin }, { data: isUpline }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase.rpc("is_ancestor", { _ancestor: context.userId, _node: data.targetId }),
    ]);
    if (!isAdmin && !isUpline) return { ok: false as const, error: transferError("FORBIDDEN") };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("transfer_balance", {
      _actor_id: context.userId,
      _target_id: data.targetId,
      _kind: data.kind,
      _amount: Math.round(data.amount * 100) / 100,
      _description: data.description.trim(),
    });
    if (error) return { ok: false as const, error: transferError(error.message) };
    return { ok: true as const };
  });
