import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/rng-games")({
  head: () => ({ meta: [{ title: "RNG GAMES — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: () => <ComingSoon title="RNG GAMES" />,
});
