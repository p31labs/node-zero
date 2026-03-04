import { useState, useCallback, useEffect } from 'react';
import { persistence } from '../lib/persistence';

export interface SpoonState {
  spoons: number;
  max: number;
  heartbeat: 'green' | 'yellow' | 'orange' | 'red';
  heartbeatPct: number;
  deepLock: boolean;
}

const MAX_SPOONS = 12;

const THRESHOLDS = {
  green: 0.58,
  yellow: 0.33,
  orange: 0.17,
};

export const SPOON_COSTS = {
  readLow: 0.5,
  readMedium: 1.0,
  readHigh: 2.0,
  readCritical: 3.0,
  compose: 1.5,
  rewrite: 0.5,
  call: 3.0,
  meeting: 2.5,
  decision: 2.0,
  taskSwitch: 1.0,
} as const;

export const SPOON_RECOVERY = {
  breathe: 0.5,
  nap: 4.0,
  meal: 2.0,
  darkRoom: 5.0,
  meds: 3.0,
  shortBreak: 1.0,
} as const;

export const HEARTBEAT_LABELS: Record<SpoonState['heartbeat'], string> = {
  green: 'SYSTEMS NOMINAL',
  yellow: 'CONSERVATION MODE',
  orange: 'DEFENSIVE MODE',
  red: 'DEEP PROCESSING LOCK',
};

export const HEARTBEAT_COLORS: Record<
  SpoonState['heartbeat'],
  { bg: string; border: string; text: string }
> = {
  green: { bg: '#052e16', border: '#22c55e', text: '#4ade80' },
  yellow: { bg: '#422006', border: '#ca8a04', text: '#facc15' },
  orange: { bg: '#431407', border: '#ea580c', text: '#fb923c' },
  red: { bg: '#450a0a', border: '#dc2626', text: '#f87171' },
};

function calcHeartbeat(spoons: number): SpoonState['heartbeat'] {
  const pct = spoons / MAX_SPOONS;
  if (pct > THRESHOLDS.green) return 'green';
  if (pct > THRESHOLDS.yellow) return 'yellow';
  if (pct > THRESHOLDS.orange) return 'orange';
  return 'red';
}

export function useSpoons() {
  const [spoons, setSpoons] = useState<number>(() => persistence.get<number>('spoons', MAX_SPOONS));

  useEffect(() => {
    persistence.set('spoons', spoons);
  }, [spoons]);

  const heartbeat = calcHeartbeat(spoons);
  const heartbeatPct = spoons / MAX_SPOONS;
  const deepLock = heartbeat === 'red';

  const spend = useCallback(
    (cost: number): boolean => {
      if (spoons < cost) return false;
      setSpoons((prev) => Math.max(0, Math.round((prev - cost) * 10) / 10));
      return true;
    },
    [spoons],
  );

  const recover = useCallback((amount: number): void => {
    setSpoons((prev) => Math.min(MAX_SPOONS, Math.round((prev + amount) * 10) / 10));
  }, []);

  const calibrate = useCallback((value: number): void => {
    setSpoons(Math.max(0, Math.min(MAX_SPOONS, value)));
  }, []);

  const state: SpoonState = { spoons, max: MAX_SPOONS, heartbeat, heartbeatPct, deepLock };

  return { ...state, spend, recover, calibrate };
}
