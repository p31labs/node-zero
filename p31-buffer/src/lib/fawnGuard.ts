/**
 * fawnGuard.ts — Detects fawn response patterns in outgoing messages
 * Fawning: people-pleasing to avoid conflict, common in PTSD/CPTSD/AuDHD
 */

export interface FawnAnalysis {
  isFawning: boolean;
  score: number;       // 0–1
  flags: string[];
  advice: string;
}

const PATTERNS: { regex: RegExp; flag: string; weight: number }[] = [
  { regex: /\bi'?m\s+sorry/i, flag: 'Unnecessary apology detected', weight: 0.3 },
  { regex: /\byou'?re\s+right/i, flag: 'Automatic agreement detected', weight: 0.25 },
  { regex: /\bwhatever\s+you\s+(want|think|need)/i, flag: 'Self-erasure pattern', weight: 0.4 },
  { regex: /\bmy\s+fault/i, flag: 'Reflexive self-blame', weight: 0.35 },
  { regex: /\bi\s+guess\s+i/i, flag: 'Minimizing own needs', weight: 0.2 },
  { regex: /\bdon'?t\s+worry\s+about\s+me/i, flag: 'Deflecting care away from self', weight: 0.3 },
  { regex: /\bit'?s?\s+(fine|okay|ok|no\s+big\s+deal)/i, flag: 'Dismissing own feelings', weight: 0.2 },
  { regex: /\bi\s+should(n'?t|nt)\s+have/i, flag: 'Retroactive self-criticism', weight: 0.25 },
  { regex: /\bplease\s+don'?t\s+be\s+(mad|angry|upset)/i, flag: 'Preemptive conflict avoidance', weight: 0.35 },
  { regex: /\bi'?ll\s+do\s+(anything|whatever)/i, flag: 'Boundary dissolution', weight: 0.4 },
];

const ADVICE_MAP: Record<string, string> = {
  low: 'Gentle check: are you saying what you mean, or what feels safe?',
  medium: 'This reads like accommodation. What do YOU actually want to say?',
  high: 'Strong fawn pattern detected. Take a breath. Your needs are valid.',
};

export function analyzeOutgoing(text: string): FawnAnalysis {
  const flags: string[] = [];
  let score = 0;

  for (const { regex, flag, weight } of PATTERNS) {
    if (regex.test(text)) {
      flags.push(flag);
      score += weight;
    }
  }

  score = Math.min(1, score);
  const isFawning = score >= 0.3;

  const level = score >= 0.6 ? 'high' : score >= 0.3 ? 'medium' : 'low';
  const advice = ADVICE_MAP[level];

  return { isFawning, score, flags, advice };
}
