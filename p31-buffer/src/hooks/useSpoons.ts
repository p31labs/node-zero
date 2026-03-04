/**
 * useSpoons.ts — Spoon Theory cognitive energy tracker
 * Spoons decay over time from interactions. Restore via breathing, rest.
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export interface SpoonState {
  spoons: number;
  spend: (amount: number) => void;
  restore: (amount: number) => void;
}

export function useSpoons(maxSpoons: number): SpoonState {
  const [spoons, setSpoons] = useState(maxSpoons);
  const spoonsRef = useRef(spoons);
  spoonsRef.current = spoons;

  // Passive decay: lose 0.02 spoons/sec (≈1 per minute of active use)
  useEffect(() => {
    const id = setInterval(() => {
      setSpoons(s => Math.max(0, s - 0.02));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const spend = useCallback((amount: number) => {
    setSpoons(s => Math.max(0, s - amount));
  }, []);

  const restore = useCallback((amount: number) => {
    setSpoons(s => Math.min(maxSpoons, s + amount));
  }, [maxSpoons]);

  return { spoons, spend, restore };
}
