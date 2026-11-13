import { createFileRoute, Link } from "@tanstack/react-router";
import { PlayerShell } from "@/components/PlayerShell";

export const Route = createFileRoute("/_authenticated/kazino/")({
  head: () => ({ meta: [{ title: "KAZINO — 90Plus" }, { name: "robots", content: "noindex" }] }),
  component: Lobby,
});

const GAMES = [
  { to: "/kazino/slots", name: "Slots", sub: "Tre rrota, fito deri 320x", icon: "casino" },
  { to: "/kazino/roulette", name: "Ruletë", sub: "Ruletë evropiane, një zero", icon: "album" },
  { to: "/kazino/blackjack", name: "Blackjack", sub: "Mund dealer-in, 21 paguan 3:2", icon: "style" },
  { to: "/kazino/crash", name: "Aviator", sub: "Merr fitimin para se të bjerë", icon: "flight_takeoff" },
] as const;

function Lobby() {
  return (
    <PlayerShell>
      <div className="cz-lobby">
        {GAMES.map((g) => (
          <Link key={g.to} to={g.to} className="cz-tile">
            <i className="material-icons">{g.icon}</i>
            <strong>{g.name}</strong>
            <span>{g.sub}</span>
            <em>Luaj</em>
          </Link>
        ))}
      </div>
    </PlayerShell>
  );
}
