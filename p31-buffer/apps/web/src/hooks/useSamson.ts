import { useState, useCallback, useRef } from 'react';

export interface SamsonState {
  H: number;
  error: number;
  valve: number;
  pTerm: 'stable' | 'drifting' | 'critical';
  drift: 'nominal' | 'looping' | 'escalating';
  burnout: 'ok' | 'warning' | 'critical';
  aiTemp: number;
  zScore: number;
}

const MARK1 = Math.PI / 9;
const Kp = 0.15;
const Ki = 0.05;
const Kd = 0.01;
const ANTI_WINDUP = 10.0;

export function useSamson() {
  const [H, setH] = useState(MARK1);
  const integral = useRef(0);
  const lastError = useRef(0);
  const history = useRef<number[]>([]);

  const update = useCallback((currentEntropy: number, dt = 1): number => {
    setH(currentEntropy);

    const e = MARK1 - currentEntropy;

    integral.current += e * dt;
    integral.current = Math.max(-ANTI_WINDUP, Math.min(ANTI_WINDUP, integral.current));

    const derivative = (e - lastError.current) / dt;
    lastError.current = e;

    const valve = Math.max(
      0,
      Math.min(1, 0.5 + Kp * e + Ki * integral.current + Kd * derivative),
    );

    history.current.push(currentEntropy);
    if (history.current.length > 20) history.current.shift();

    return valve;
  }, []);

  const error = MARK1 - H;
  const absError = Math.abs(error);

  const pTerm: SamsonState['pTerm'] =
    absError < 0.05 ? 'stable' : absError < 0.15 ? 'drifting' : 'critical';

  const recentLen = history.current.length;
  let drift: SamsonState['drift'] = 'nominal';
  if (recentLen >= 5) {
    const last5 = history.current.slice(-5);
    const allRising = last5.every((v, i) => i === 0 || v >= last5[i - 1]);
    const allFalling = last5.every((v, i) => i === 0 || v <= last5[i - 1]);
    if ((allRising && H > MARK1 + 0.1) || (allFalling && H < MARK1 - 0.1)) {
      drift = 'escalating';
    } else if (allRising || allFalling) {
      drift = 'looping';
    }
  }

  const burnout: SamsonState['burnout'] =
    recentLen >= 3 && history.current.slice(-3).every((v) => v > MARK1 + 0.15)
      ? 'critical'
      : recentLen >= 3 && history.current.slice(-3).every((v) => v > MARK1 + 0.05)
        ? 'warning'
        : 'ok';

  const aiTemp = Math.max(0.1, Math.min(0.9, 0.5 - error));

  const mean = recentLen > 0 ? history.current.reduce((a, b) => a + b, 0) / recentLen : MARK1;
  const variance =
    recentLen > 1
      ? history.current.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (recentLen - 1)
      : 0;
  const stdDev = Math.sqrt(variance) || 0.01;
  const zScore = Math.round(((H - mean) / stdDev) * 100) / 100;

  const valve = Math.max(
    0,
    Math.min(
      1,
      0.5 + Kp * error + Ki * integral.current + Kd * (error - lastError.current),
    ),
  );

  const state: SamsonState = { H, error, valve, pTerm, drift, burnout, aiTemp, zScore };

  const applyTrimtab = useCallback(
    (offset: number) => {
      const adjusted = H + offset * 0.02;
      setH(Math.max(0, Math.min(1, adjusted)));
    },
    [H],
  );

  const reset = useCallback(() => {
    setH(MARK1);
    integral.current = 0;
    lastError.current = 0;
    history.current = [];
  }, []);

  return { ...state, update, applyTrimtab, reset, MARK1 };
}
