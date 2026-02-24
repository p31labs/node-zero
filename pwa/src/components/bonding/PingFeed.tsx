import type { GameState } from "../../lib/bonding/game-store";

interface Props {
  game: GameState;
}

function ago(iso: string): string {
  const sec = (Date.now() - new Date(iso).getTime()) / 1000;
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
}

export function PingFeed({ game }: Props) {
  const recent = game.pings.slice(-5).reverse();
  if (recent.length === 0) return null;

  return (
    <div
      style={{
        padding: "8px 12px",
        background: "#0c0c18",
        borderTop: "1px solid rgba(255,255,255,0.06)",
        fontSize: 11,
        color: "#888",
        fontFamily: "'DM Mono', monospace",
      }}
    >
      {recent.map((p, i) => {
        const player = game.players[p.from];
        const atom = game.atoms.find((a) => a.id === p.atomId);
        const sym = atom?.element ?? "?";
        return (
          <div key={i} style={{ marginBottom: 4 }}>
            {p.reaction} {player?.name ?? "?"} · {sym} · {ago(p.timestamp)}
          </div>
        );
      })}
    </div>
  );
}
