import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/virtuals")({
  head: () => ({ meta: [{ title: "VIRTUALS — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: () => <ComingSoon title="VIRTUALS" />,
});
