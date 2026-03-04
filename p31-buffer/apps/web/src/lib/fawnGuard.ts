/**
 * FAWN GUARD: Outgoing transmission interceptor.
 * Detects impedance mismatches, over-explaining, and trauma-responses.
 */
export interface FawnAnalysis {
  isFawning: boolean;
  flags: string[];
  advice: string;
}

export function analyzeOutgoing(text: string): FawnAnalysis {
  const flags: string[] = [];
  const lower = text.toLowerCase();

  const apologies = (lower.match(/sorry|apologize|my fault|my bad/g) || []).length;
  if (apologies > 1) flags.push("Multiple apologies detected.");

  const qualifiers = (lower.match(/\bjust\b|\bmaybe\b|\bi think\b|\bpossibly\b|\bmake sense\b|\bif that\'s ok\b/g) || []).length;
  if (qualifiers > 2) flags.push("High density of softening qualifiers.");

  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
  if (sentences.length > 5 && !text.includes('\\n')) {
    flags.push("Potential over-explaining (dense block of text).");
  }

  const peopleManaging = (lower.match(/\bi don\'t want to bother\b|\bno worries if not\b|\bfeel free to ignore\b|\bsorry to ask\b/g) || []).length;
  if (peopleManaging > 0) flags.push("Reaction-managing language detected.");

  return {
    isFawning: flags.length > 0,
    flags,
    advice: flags.length > 0
      ? "Pause. Are you communicating your truth, or managing their reaction?"
      : "Signal clear.",
  };
}
