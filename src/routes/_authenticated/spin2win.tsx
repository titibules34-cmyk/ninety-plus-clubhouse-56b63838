import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/spin2win")({
  head: () => ({ meta: [{ title: "GAME_SPIN2WIN — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: () => <ComingSoon title="GAME_SPIN2WIN" />,
});
