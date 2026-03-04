import { useState, useCallback } from 'react';
import { computeVoltage, extractBLUF } from '../lib/voltage-engine';
import { SPOON_COSTS } from './useSpoons';

export function useVoltage() {
  const [lastScore, setLastScore] = useState<ReturnType<typeof computeVoltage> | null>(null);
  const [lastBLUF, setLastBLUF] = useState<string | null>(null);

  const score = useCallback((text: string) => {
    const result = computeVoltage(text);
    const bluf = extractBLUF(text);
    setLastScore(result);
    setLastBLUF(bluf);
    return { ...result, bluf };
  }, []);

  const spoonCostForGate = useCallback((gate: string): number => {
    switch (gate) {
      case 'GREEN':
        return SPOON_COSTS.readLow;
      case 'YELLOW':
        return SPOON_COSTS.readMedium;
      case 'RED':
        return SPOON_COSTS.readHigh;
      case 'CRITICAL':
        return SPOON_COSTS.readCritical;
      default:
        return SPOON_COSTS.readLow;
    }
  }, []);

  const clear = useCallback(() => {
    setLastScore(null);
    setLastBLUF(null);
  }, []);

  return { lastScore, lastBLUF, score, spoonCostForGate, clear };
}
