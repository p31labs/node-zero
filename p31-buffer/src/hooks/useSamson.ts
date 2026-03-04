/**
 * useSamson.ts — SAMSON V2 PID Controller
 * Governs system "health" by tracking Shannon entropy of spoon usage.
 * Target: H ≈ 0.349 (balanced, not over-extended, not under-utilized)
 *
 * Outputs:
 *   H — current entropy (0–1)
 *   error — deviation from target
 *   pTerm — proportional assessment ('nominal' | 'overloaded' | 'underloaded')
 *   drift — integral term ('nominal' | 'looping' | 'stagnant')
 *   burnout — derivative term ('ok' | 'warning' | 'critical')
 *   tension — composite 0–1 that drives jitterbug contraction
 *   aiTemp — suggested AI temperature for response generation
 *   zScore — standard deviations from mean
 */
import { useState, useEffect, useRef } from 'react';

export interface SamsonState {
  H: number;
  error: number;
  pTerm: 'nominal' | 'overloaded' | 'underloaded';
  drift: 'nominal' | 'looping' | 'stagnant';
  burnout: 'ok' | 'warning' | 'critical';
  tension: number;
  aiTemp: number;
  zScore: number;
}

const TARGET_H = 0.349;
const HISTORY_SIZE = 60; // 60 samples at 1Hz = 1 minute window

function shannon(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  if (sum === 0) return 0;
  const probs = values.map(v => v / sum).filter(p => p > 0);
  return -probs.reduce((h, p) => h + p * Math.log2(p), 0);
}

export function useSamson(spoons: number, maxSpoons: number): SamsonState {
  const [state, setState] = useState<SamsonState>({
    H: TARGET_H,
    error: 0,
    pTerm: 'nominal',
    drift: 'nominal',
    burnout: 'ok',
    tension: 0,
    aiTemp: 0.7,
    zScore: 0,
  });

  const historyRef = useRef<number[]>([]);
  const integralRef = useRef(0);
  const prevErrorRef = useRef(0);

  useEffect(() => {
    const id = setInterval(() => {
      const history = historyRef.current;
      const ratio = maxSpoons > 0 ? spoons / maxSpoons : 1;

      // Add sample, keep window
      history.push(ratio);
      if (history.length > HISTORY_SIZE) history.shift();

      // Bin into 5 energy levels for entropy calculation
      const bins = [0, 0, 0, 0, 0]; // [0-20%, 20-40%, 40-60%, 60-80%, 80-100%]
      for (const v of history) {
        const idx = Math.min(4, Math.floor(v * 5));
        bins[idx]++;
      }

      const H = Math.min(1, shannon(bins) / Math.log2(5)); // normalize to 0–1
      const error = H - TARGET_H;

      // PID terms
      const Kp = 1.0, Ki = 0.1, Kd = 0.3;

      // P — proportional
      const pTerm: SamsonState['pTerm'] =
        error > 0.15 ? 'overloaded' :
        error < -0.15 ? 'underloaded' :
        'nominal';

      // I — integral (drift detection)
      integralRef.current = integralRef.current * 0.95 + error * Ki;
      const iVal = integralRef.current;
      const drift: SamsonState['drift'] =
        Math.abs(iVal) > 0.3 ? (iVal > 0 ? 'looping' : 'stagnant') :
        'nominal';

      // D — derivative (burnout detection)
      const dVal = (error - prevErrorRef.current) * Kd;
      prevErrorRef.current = error;
      const burnout: SamsonState['burnout'] =
        dVal > 0.15 ? 'critical' :
        dVal > 0.05 ? 'warning' :
        'ok';

      // Composite tension: 0–1
      const rawTension = Math.abs(error * Kp) + Math.abs(iVal) + Math.abs(dVal);
      const tension = Math.min(1, Math.max(0, rawTension));

      // AI temperature: calm = creative (0.9), stressed = precise (0.3)
      const aiTemp = 0.3 + (1 - tension) * 0.6;

      // Z-score (how many SDs from mean)
      const mean = history.reduce((a, b) => a + b, 0) / history.length;
      const variance = history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length;
      const std = Math.sqrt(variance) || 0.001;
      const zScore = (ratio - mean) / std;

      setState({ H, error, pTerm, drift, burnout, tension, aiTemp, zScore });
    }, 1000);

    return () => clearInterval(id);
  }, [spoons, maxSpoons]);

  return state;
}
