import { useState, useCallback } from 'react';

export interface SpoonState {
  spoons: number;
  maxSpoons: number;
  spend: (cost: number) => void;
  restore: (amount: number) => void;
  reset: () => void;
}

export function useSpoons(max: number): SpoonState {
  const [spoons, setSpoons] = useState(max);

  const spend = useCallback((cost: number) => {
    setSpoons(s => Math.max(0, +(s - cost).toFixed(1)));
  }, []);

  const restore = useCallback((amount: number) => {
    setSpoons(s => Math.min(max, +(s + amount).toFixed(1)));
  }, [max]);

  const reset = useCallback(() => {
    setSpoons(max);
  }, [max]);

  return { spoons, maxSpoons: max, spend, restore, reset };
}
