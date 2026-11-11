import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/gara-bingo-keno")({
  head: () => ({ meta: [{ title: "GARA-BINGO-KENO — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: () => <ComingSoon title="GARA-BINGO-KENO" />,
});
