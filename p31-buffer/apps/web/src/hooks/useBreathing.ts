import { useState, useCallback, useRef, useEffect } from 'react';

export type BreathPhase = 'idle' | 'in' | 'hold' | 'out';

export interface BreathingState {
  phase: BreathPhase;
  progress: number;
  cycle: number;
  totalCycles: number;
  active: boolean;
  elapsed: number;
}

const CYCLE = { in: 4, hold: 2, out: 6 };
const TOTAL_CYCLE_TIME = CYCLE.in + CYCLE.hold + CYCLE.out;

export function useBreathing(targetCycles = 3) {
  const [phase, setPhase] = useState<BreathPhase>('idle');
  const [progress, setProgress] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [active, setActive] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const startTime = useRef(0);
  const frameRef = useRef(0);

  const tick = useCallback(() => {
    const now = Date.now();
    const totalElapsed = (now - startTime.current) / 1000;
    const currentCycle = Math.floor(totalElapsed / TOTAL_CYCLE_TIME);

    if (currentCycle >= targetCycles) {
      setActive(false);
      setPhase('idle');
      setProgress(0);
      setCycle(0);
      setElapsed(0);
      return;
    }

    setCycle(currentCycle);
    const cyclePos = totalElapsed % TOTAL_CYCLE_TIME;

    if (cyclePos < CYCLE.in) {
      setPhase('in');
      setProgress(cyclePos / CYCLE.in);
      setElapsed(cyclePos);
    } else if (cyclePos < CYCLE.in + CYCLE.hold) {
      setPhase('hold');
      setProgress((cyclePos - CYCLE.in) / CYCLE.hold);
      setElapsed(cyclePos - CYCLE.in);
    } else {
      setPhase('out');
      setProgress((cyclePos - CYCLE.in - CYCLE.hold) / CYCLE.out);
      setElapsed(cyclePos - CYCLE.in - CYCLE.hold);
    }

    frameRef.current = requestAnimationFrame(tick);
  }, [targetCycles]);

  const start = useCallback(() => {
    startTime.current = Date.now();
    setActive(true);
    setCycle(0);
    setPhase('in');
    setProgress(0);
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const stop = useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    setActive(false);
    setPhase('idle');
    setProgress(0);
    setCycle(0);
    setElapsed(0);
  }, []);

  useEffect(() => {
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const state: BreathingState = {
    phase,
    progress,
    cycle,
    totalCycles: targetCycles,
    active,
    elapsed,
  };

  return { ...state, start, stop };
}
