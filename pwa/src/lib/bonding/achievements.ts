import type { GameState } from "./game-store";
import { ELEMENTS } from "./elements";

interface Achievement {
  id: string;
  name: string;
  desc: string;
  check: (g: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: "first_bond", name: "First Bond", desc: "Place your first atom", check: (g) => g.atoms.length >= 2 },
  { id: "water", name: "Water World", desc: "Build H₂O", check: (g) => g.formula === "H₂O" },
  { id: "salt", name: "Salty", desc: "Build NaCl", check: (g) => g.formula === "NaCl" },
  { id: "carbon_life", name: "Carbon Life", desc: "Use 4+ carbon atoms", check: (g) => g.atoms.filter((a) => a.element === "C").length >= 4 },
  { id: "teamwork", name: "Teamwork", desc: "Both players placed atoms", check: (g) => new Set(g.atoms.map((a) => a.placedBy)).size >= 2 },
  { id: "ten", name: "Decahedron", desc: "10-atom molecule", check: (g) => g.atoms.length >= 10 },
  { id: "phosphorus", name: "P31", desc: "Use phosphorus", check: (g) => g.atoms.some((a) => a.element === "P") },
  { id: "calcium", name: "Bones", desc: "Use calcium", check: (g) => g.atoms.some((a) => a.element === "Ca") },
  { id: "chatty", name: "Chatty", desc: "Send 5 pings", check: (g) => g.pings.length >= 5 },
  { id: "gold", name: "Sovereign", desc: "Use gold", check: (g) => g.atoms.some((a) => a.element === "Au") },
  { id: "heavy", name: "Heavy Metal", desc: "Use an element past #50", check: (g) => g.atoms.some((a) => (ELEMENTS.find((e) => e.symbol === a.element)?.number ?? 0) > 50) },
];

export function checkAchievements(game: GameState): string[] {
  return ACHIEVEMENTS.filter((a) => !game.achievements.includes(a.id) && a.check(game)).map((a) => a.id);
}
