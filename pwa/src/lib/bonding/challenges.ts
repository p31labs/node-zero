/**
 * Tier 1 molecule challenges — sequential unlock.
 * Ordered easiest → hardest by atom count.
 * A challenge unlocks when the previous one has been completed at least once.
 */

export interface Challenge {
  id: string;
  name: string;
  formula: string;
  formulaAscii: string;
  hint: string;
  emoji: string;
  points: number;
  funFact: string;
}

export const CHALLENGES: Challenge[] = [
  {
    id: "h2",
    name: "Hydrogen Gas",
    formula: "H₂",
    formulaAscii: "H2",
    hint: "2 Hydrogen atoms",
    emoji: "\u26A1",
    points: 50,
    funFact: "The sun burns 600 million tons of this every second.",
  },
  {
    id: "nacl",
    name: "Table Salt",
    formula: "NaCl",
    formulaAscii: "NaCl",
    hint: "1 Sodium + 1 Chlorine",
    emoji: "\uD83E\uDDC2",
    points: 100,
    funFact: "Your body has about 250 grams of salt in it right now.",
  },
  {
    id: "h2o",
    name: "Water",
    formula: "H\u2082O",
    formulaAscii: "H2O",
    hint: "2 Hydrogen + 1 Oxygen",
    emoji: "\uD83D\uDCA7",
    points: 100,
    funFact: "You're 60% this. So is the Earth.",
  },
  {
    id: "o2",
    name: "Oxygen Gas",
    formula: "O\u2082",
    formulaAscii: "O2",
    hint: "2 Oxygen atoms",
    emoji: "\uD83C\uDF2C\uFE0F",
    points: 75,
    funFact: "Trees make this. You breathe it. Thank a tree.",
  },
  {
    id: "co2",
    name: "Carbon Dioxide",
    formula: "CO\u2082",
    formulaAscii: "CO2",
    hint: "1 Carbon + 2 Oxygen",
    emoji: "\uD83D\uDCA8",
    points: 150,
    funFact: "Plants eat this for breakfast. You breathe it out.",
  },
  {
    id: "nh3",
    name: "Ammonia",
    formula: "NH\u2083",
    formulaAscii: "NH3",
    hint: "1 Nitrogen + 3 Hydrogen",
    emoji: "\uD83E\uDDEA",
    points: 150,
    funFact: "Smells terrible. Helps grow all the food in the world.",
  },
  {
    id: "ch4",
    name: "Methane",
    formula: "CH\u2084",
    formulaAscii: "CH4",
    hint: "1 Carbon + 4 Hydrogen",
    emoji: "\uD83D\uDD25",
    points: 200,
    funFact: "Cows burp this. It heats your house.",
  },
];

const STORAGE_KEY = "p31-bonding-completed";

export function getCompletedChallenges(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function markChallengeCompleted(id: string): void {
  const completed = getCompletedChallenges();
  completed.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...completed]));
  } catch {
    // Silent
  }
}

export function getUnlockedChallenges(): Challenge[] {
  const completed = getCompletedChallenges();
  const unlocked: Challenge[] = [];
  for (let i = 0; i < CHALLENGES.length; i++) {
    if (i === 0 || completed.has(CHALLENGES[i - 1]!.id)) {
      unlocked.push(CHALLENGES[i]!);
    } else {
      break;
    }
  }
  return unlocked;
}
