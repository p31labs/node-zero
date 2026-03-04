/**
 * useBreathing.ts — 4-2-6 breathing pacer
 * Inhale 4s → Hold 2s → Exhale 6s = 12s cycle
 * Each complete cycle calls onCycleComplete (typically restores 0.5 spoons)
 */
import { useState, useRef, useCallback, useEffect } from 'react';

export type BreathPhase = 'in' | 'hold' | 'out';

export interface BreathingState {
  breathing: boolean;
  phase: BreathPhase;
  startBreathing: () => void;
  stopBreathing: () => void;
}

const DURATIONS: Record<BreathPhase, number> = { in: 4000, hold: 2000, out: 6000 };
const SEQUENCE: BreathPhase[] = ['in', 'hold', 'out'];

export function useBreathing(onCycleComplete: () => void): BreathingState {
  const [breathing, setBreathing] = useState(false);
  const [phase, setPhase] = useState<BreathPhase>('in');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cycleRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runPhase = useCallback((phaseIdx: number) => {
    const p = SEQUENCE[phaseIdx % 3];
    setPhase(p);

    timerRef.current = setTimeout(() => {
      const next = phaseIdx + 1;
      if (next % 3 === 0) {
        // Completed a full cycle
        onCycleComplete();
        cycleRef.current++;
        // Auto-stop after 3 cycles
        if (cycleRef.current >= 3) {
          setBreathing(false);
          return;
        }
      }
      runPhase(next);
    }, DURATIONS[p]);
  }, [onCycleComplete]);

  const startBreathing = useCallback(() => {
    clearTimer();
    cycleRef.current = 0;
    setBreathing(true);
    setPhase('in');
    runPhase(0);
  }, [clearTimer, runPhase]);

  const stopBreathing = useCallback(() => {
    clearTimer();
    setBreathing(false);
  }, [clearTimer]);

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), [clearTimer]);

  return { breathing, phase, startBreathing, stopBreathing };
}
