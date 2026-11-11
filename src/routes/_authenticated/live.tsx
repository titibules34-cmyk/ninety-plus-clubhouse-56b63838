import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/live")({
  head: () => ({ meta: [{ title: "LIVE — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: () => <ComingSoon title="LIVE" />,
});
