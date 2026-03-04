import { useState, useEffect, useCallback, useRef } from 'react';

const INHALE = 4;
const HOLD = 2;
const EXHALE = 6;
const TOTAL = INHALE + HOLD + EXHALE; // 12s per cycle
const CYCLES_TO_COMPLETE = 3;

export type BreathPhase = 'in' | 'hold' | 'out';

export interface BreathingState {
  breathing: boolean;
  phase: BreathPhase;
  cycleCount: number;
  startBreathing: () => void;
  stopBreathing: () => void;
}

export function useBreathing(onComplete?: () => void): BreathingState {
  const [breathing, setBreathing] = useState(false);
  const [sec, setSec] = useState(0);
  const [cycles, setCycles] = useState(0);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  const phase: BreathPhase =
    sec < INHALE ? 'in' :
    sec < INHALE + HOLD ? 'hold' : 'out';

  const startBreathing = useCallback(() => {
    setSec(0);
    setCycles(0);
    setBreathing(true);
  }, []);

  const stopBreathing = useCallback(() => {
    setBreathing(false);
    setSec(0);
    setCycles(0);
  }, []);

  useEffect(() => {
    if (!breathing) return;
    const id = setInterval(() => {
      setSec(s => {
        const next = s + 1;
        if (next >= TOTAL) {
          setCycles(c => c + 1);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [breathing]);

  // Auto-complete after N cycles
  useEffect(() => {
    if (cycles >= CYCLES_TO_COMPLETE && breathing) {
      setBreathing(false);
      setSec(0);
      setCycles(0);
      completeRef.current?.();
    }
  }, [cycles, breathing]);

  return { breathing, phase, cycleCount: cycles, startBreathing, stopBreathing };
}
