import { useState, useEffect } from "react";
import { useCognitiveLoad } from "../../context/CognitiveLoadContext";
import type { GameState } from "../../lib/bonding/game-store";
import type { Challenge } from "../../lib/bonding/challenges";

const MOLECULE_EMOJI: Record<string, string> = {
  "Water - you're 60% this": "💧",
  "Table salt": "🧂",
  "Hydrogen gas": "💨",
  "Oxygen - you breathe this": "💨",
  "Carbon dioxide - you exhale this": "💨",
  "Glucose - sugar, energy, life": "🍬",
};

interface Props {
  game: GameState;
  knownMolecule: string | null;
  challenge?: Challenge;
}

export function GameHeader({ game, knownMolecule, challenge }: Props) {
  const { isMinimal, isCrisis } = useCognitiveLoad();
  const [showMoleculeBanner, setShowMoleculeBanner] = useState(false);
  const [bannerFade, setBannerFade] = useState(false);

  useEffect(() => {
    if (knownMolecule) {
      setShowMoleculeBanner(true);
      setBannerFade(false);
      const fade = setTimeout(() => setBannerFade(true), 2700);
      const hide = setTimeout(() => setShowMoleculeBanner(false), 3000);
      return () => {
        clearTimeout(fade);
        clearTimeout(hide);
      };
    }
  }, [knownMolecule]);

  if (isCrisis) return null;

  const current = game.players[game.currentTurn];
  const turnLabel = current ? `${current.name.toUpperCase()}'S TURN` : "";
  const emoji = knownMolecule ? MOLECULE_EMOJI[knownMolecule] ?? "✨" : "";

  return (
    <header
      style={{
        padding: "12px 16px",
        background: "#0c0c18",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {challenge && (
            <span style={{ fontSize: 13, color: "#31ffa3", fontWeight: 600 }}>
              Build: {challenge.name} {challenge.emoji}
            </span>
          )}
          {!challenge && <span style={{ fontSize: 12, color: "#888", letterSpacing: 1 }}>{game.name}</span>}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 11, color: "#666", fontFamily: "'DM Mono', monospace" }}>
            T{game.turnCount}
          </span>
          {game.score > 0 && (
            <span style={{ fontSize: 11, color: "#f59e0b", fontFamily: "'DM Mono', monospace" }}>
              {game.score}pts
            </span>
          )}
          <span
            style={{
              fontSize: 12,
              color: current?.color ?? "#31ffa3",
              fontWeight: 600,
              letterSpacing: 1,
              animation: "turnPulse 2s ease-in-out infinite",
            }}
          >
            {turnLabel}
          </span>
        </div>
      </div>
      {challenge && (
        <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
          {challenge.hint} · {challenge.points}pts
        </div>
      )}
      {!isMinimal && (
        <>
          <div style={{ fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#ccc", marginTop: 6 }}>
            {game.formula || "—"} {game.totalMass > 0 && `· ${game.totalMass.toFixed(1)} g/mol`}
          </div>
          <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>
            {game.atoms.filter((a) => a.placedBy === 0).length} / {game.atoms.filter((a) => a.placedBy === 1).length} atoms
          </div>
        </>
      )}
      {showMoleculeBanner && knownMolecule && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 12px",
            background: "rgba(49,255,163,0.15)",
            border: "1px solid #31ffa340",
            borderRadius: 8,
            fontSize: 14,
            color: "#31ffa3",
            fontWeight: 600,
            transition: "opacity 0.3s ease-out",
            opacity: bannerFade ? 0 : 1,
          }}
        >
          That's {knownMolecule.split(" — ")[0].toUpperCase()}! {emoji}
        </div>
      )}
      <style>{`@keyframes turnPulse { 0%, 100% { opacity: 0.7; } 50% { opacity: 1; } }`}</style>
    </header>
  );
}
