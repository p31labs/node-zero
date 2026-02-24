import { ELEMENTS } from "./elements";
import type { PlacedAtom } from "./game-store";

export function canBond(symbol: string, currentBonds: number): boolean {
  const el = ELEMENTS.find((e) => e.symbol === symbol);
  if (!el) return false;
  return currentBonds < el.valence;
}

function sub(n: number): string {
  return String(n).replace(/\d/g, (d) => "₀₁₂₃₄₅₆₇₈₉"[+d]);
}

export function buildFormula(atoms: PlacedAtom[]): string {
  const counts: Record<string, number> = {};
  for (const a of atoms) counts[a.element] = (counts[a.element] || 0) + 1;
  const keys = Object.keys(counts).sort((a, b) => {
    if (a === "C") return -1;
    if (b === "C") return 1;
    if (a === "H") return -1;
    if (b === "H") return 1;
    return a.localeCompare(b);
  });
  return keys.map((k) => k + (counts[k]! > 1 ? sub(counts[k]!) : "")).join("");
}

export function totalMass(atoms: PlacedAtom[]): number {
  return atoms.reduce((sum, a) => {
    const el = ELEMENTS.find((e) => e.symbol === a.element);
    return sum + (el?.mass ?? 0);
  }, 0);
}

const SUBSCRIPT = "\u2080\u2081\u2082\u2083\u2084\u2085\u2086\u2087\u2088\u2089"; // ₀₁₂₃₄₅₆₇₈₉
function formulaToAscii(f: string): string {
  return [...f].map((c) => { const i = SUBSCRIPT.indexOf(c); return i >= 0 ? String(i) : c; }).join("");
}

const KNOWN_MOLECULES: Record<string, string> = {
  H2: "Hydrogen gas",
  O2: "Oxygen - you breathe this",
  H2O: "Water - you're 60% this",
  CO2: "Carbon dioxide - you exhale this",
  CH4: "Methane",
  NH3: "Ammonia",
  NaCl: "Table salt",
  CaCO3: "Chalk, shells, antacids",
  C6H12O6: "Glucose - sugar, energy, life",
};

export function identifyMolecule(formula: string): string | null {
  return KNOWN_MOLECULES[formulaToAscii(formula)] ?? null;
}
