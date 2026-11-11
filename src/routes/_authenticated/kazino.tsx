import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/kazino")({
  head: () => ({ meta: [{ title: "KAZINO — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: () => <ComingSoon title="KAZINO" />,
});
