/**
 * On-device voltage scoring engine — zero cloud dependency
 * Scores message text on 3 axes: urgency, emotional, cognitive
 * Returns composite voltage 0-100 with gate color
 */

export interface VoltageResult {
  urgency: number;
  emotional: number;
  cognitive: number;
  voltage: number;
  gate: 'GREEN' | 'YELLOW' | 'RED' | 'CRITICAL';
  color: string;
  paHits: { pattern: RegExp; rewrite: string }[];
}

const URGENCY_HIGH = [/\b(immediately|urgent|asap|deadline|time.?sensitive|right now)\b/i];
const URGENCY_MED = [/\b(soon|quickly|priority|important|pressing)\b/i];
const URGENCY_LOW = [/\b(whenever|no rush|when you can|at your convenience)\b/i];

const EMOTIONAL_HIGH = [
  /\b(furious|livid|disgusted|hate|despise|enraged)\b/i,
  /\b(pathetic|worthless|failure|shame|ashamed|disgusting)\b/i,
];
const EMOTIONAL_MED = [
  /\b(frustrated|annoyed|upset|angry|hurt|disappointed)\b/i,
  /\b(worried|anxious|scared|afraid|nervous|concerned)\b/i,
];
const EMOTIONAL_LOW = [
  /\b(happy|glad|grateful|appreciate|thankful|pleased)\b/i,
  /\b(calm|relaxed|content|fine|okay|good)\b/i,
];

const COGNITIVE_HIGH = [/\b(analyze|evaluate|synthesize|compare|contrast|justify)\b/i];
const COGNITIVE_MED = [/\b(explain|describe|discuss|consider|determine)\b/i];
const COGNITIVE_LOW = [/\b(yes|no|ok|sure|thanks|got it)\b/i];

const PASSIVE_AGGRESSIVE = [
  { pattern: /per my last (email|message)/i, rewrite: 'They feel ignored.' },
  { pattern: /as (previously |I )?(stated|mentioned|noted)/i, rewrite: 'They believe you should already know this.' },
  { pattern: /just to clarify/i, rewrite: 'They think you misunderstood.' },
  { pattern: /friendly reminder/i, rewrite: "They've asked before and want action." },
  { pattern: /I('ll| will) (just |)go ahead and/i, rewrite: 'They plan to act without your input.' },
  { pattern: /correct me if I('m| am) wrong/i, rewrite: 'They believe they are right.' },
  { pattern: /thanks in advance/i, rewrite: 'They expect compliance.' },
  { pattern: /not sure if you (saw|got|received)/i, rewrite: 'They think you ignored them.' },
  { pattern: /hope(fully)? this helps/i, rewrite: 'They may feel you should already know this.' },
];

function scoreAxis(text: string, high: RegExp[], med: RegExp[], low: RegExp[]): number {
  let score = 5;
  let hHits = 0,
    mHits = 0,
    lHits = 0;
  high.forEach((p) => {
    if (p.test(text)) hHits++;
  });
  med.forEach((p) => {
    if (p.test(text)) mHits++;
  });
  low.forEach((p) => {
    if (p.test(text)) lHits++;
  });

  if (hHits > 0) score = Math.min(10, 7 + hHits);
  else if (mHits > 0) score = Math.min(7, 4 + mHits);
  else if (lHits > 0) score = Math.max(1, 3 - lHits);

  return Math.max(1, Math.min(10, score));
}

export function computeVoltage(text: string): VoltageResult {
  if (!text.trim()) {
    return { urgency: 1, emotional: 1, cognitive: 1, voltage: 0, gate: 'GREEN', color: '#33FF33', paHits: [] };
  }

  const u = scoreAxis(text, URGENCY_HIGH, URGENCY_MED, URGENCY_LOW);
  const e = scoreAxis(text, EMOTIONAL_HIGH, EMOTIONAL_MED, EMOTIONAL_LOW);
  const c = scoreAxis(text, COGNITIVE_HIGH, COGNITIVE_MED, COGNITIVE_LOW);

  const words = text.split(/\s+/).length;
  let cAdj = c;
  if (words > 300) cAdj = Math.min(10, cAdj + 2);
  else if (words > 150) cAdj = Math.min(10, cAdj + 1);
  const questions = (text.match(/\?/g) || []).length;
  if (questions > 3) cAdj = Math.min(10, cAdj + 2);
  else if (questions > 1) cAdj = Math.min(10, cAdj + 1);

  let eAdj = e;
  const capsWords = (text.match(/\b[A-Z]{4,}\b/g) || []).length;
  if (capsWords > 2) eAdj = Math.min(10, eAdj + 2);

  const raw = u * 0.3 + eAdj * 0.4 + cAdj * 0.3;
  const voltage = Math.round((1 - Math.exp(-raw / 2.5)) * 100);

  let gate: VoltageResult['gate'] = 'GREEN';
  let color = '#33FF33';
  if (voltage >= 75) {
    gate = 'CRITICAL';
    color = '#FF6B6B';
  } else if (voltage >= 55) {
    gate = 'RED';
    color = '#ef4444';
  } else if (voltage >= 35) {
    gate = 'YELLOW';
    color = '#FFB000';
  }

  const paHits = PASSIVE_AGGRESSIVE.filter((pa) => pa.pattern.test(text));

  return { urgency: u, emotional: eAdj, cognitive: cAdj, voltage, gate, color, paHits };
}

export function extractBLUF(text: string): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g);
  if (!sentences || sentences.length <= 2) return text;

  const askIdx = sentences.findIndex((s) =>
    /\b(can you|could you|would you|please|need|want|require|must)\b/i.test(s),
  );
  const factIdx = sentences.findIndex((s) =>
    /\b(because|since|the reason|given that|due to)\b/i.test(s),
  );

  const parts: string[] = [];
  if (askIdx >= 0) parts.push('REQUEST: ' + sentences[askIdx].trim());
  if (factIdx >= 0) parts.push('CONTEXT: ' + sentences[factIdx].trim());
  if (parts.length === 0) parts.push(sentences[0].trim());

  return parts.join('\n');
}
