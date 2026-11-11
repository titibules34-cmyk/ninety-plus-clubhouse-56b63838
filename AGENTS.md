<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

## Project rules

- Accounts sign in by username; `src/lib/username.ts` maps each username to a synthetic auth email, and only admins (server functions) create accounts — there is no public signup page.
- Roles live in `user_roles` and are checked with `has_role`; balances and profile fields are admin-editable only (RLS).
- Odds come from The Odds API through the connector gateway (`src/lib/odds.server.ts`), cached in `odds_cache` to save provider credits; displayed prices are the average across bookmakers (`normalizeEvent`).
- Money moves only inside SECURITY DEFINER SQL functions (`place_bet`, `settle_selections`) callable by service_role; server functions re-price picks from the cache before calling them. A placed stake is held in `profiles.pending` until settlement.
- Settlement runs from the hourly managed schedule hitting `/api/public/jobs/settle-bets` (cron-authenticated).
