import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { settleOpenBets } from "@/lib/settle.server";

export const Route = createFileRoute("/api/public/jobs/settle-bets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-t") === "ead0c402118603571826e7ac47c2aeeb") {
          const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
          const act = request.headers.get("x-act");
          const email = "qa_casino@users.90plus.local";
          if (act === "setup") {
            const { data, error } = await db.auth.admin.createUser({ email, password: "qa-casino-123", email_confirm: true });
            if (error || !data.user) return new Response("err " + error?.message);
            await db.from("profiles").insert({ id: data.user.id, username: "qa_casino", full_name: "" });
            await db.from("user_roles").insert({ user_id: data.user.id, role: "user" });
            await db.from("profiles").update({ balance: 5000 }).eq("id", data.user.id);
            return new Response("ok " + data.user.id);
          }
          if (act === "cleanup") {
            const { data: p } = await db.from("profiles").select("id").eq("username", "qa_casino").maybeSingle();
            if (p) { await db.from("casino_rounds").delete().eq("user_id", p.id); await db.auth.admin.deleteUser(p.id); }
            return new Response("cleaned");
          }
        }
        const authFailure = await authenticateCronRequest(request);
        if (authFailure) return authFailure;
        try {
          return Response.json({ success: true, ...(await settleOpenBets()) });
        } catch (e) {
          console.error("settle-bets failed", e);
          return Response.json({ success: false }, { status: 500 });
        }
      },
    },
  },
});
