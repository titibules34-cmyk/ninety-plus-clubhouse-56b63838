import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { settleOpenBets } from "@/lib/settle.server";

export const Route = createFileRoute("/api/public/jobs/settle-bets")({
  server: {
    handlers: {
      POST: async ({ request }) => {
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
