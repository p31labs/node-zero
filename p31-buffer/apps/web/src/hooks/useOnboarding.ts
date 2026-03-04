import { useState, useCallback } from 'react';
import { persistence } from '../lib/persistence';

export type OnboardingGate = 0 | 1 | 2 | 3 | 4;

export interface SensoryProfile {
  motionScale: number;
  glowIntensity: number;
  soundEnabled: boolean;
  hapticEnabled: boolean;
}

export interface CalibrationData {
  sensory: SensoryProfile;
  initialSpoons: number;
  name: string;
  completedAt: string;
}

const DEFAULT_SENSORY: SensoryProfile = {
  motionScale: 0.7,
  glowIntensity: 0.6,
  soundEnabled: false,
  hapticEnabled: false,
};

export function useOnboarding() {
  const [gate, setGate] = useState<OnboardingGate>(() => {
    const saved = persistence.get<CalibrationData | null>('calibration', null);
    return saved ? 4 : 0;
  });

  const [sensory, setSensory] = useState<SensoryProfile>(() => {
    const saved = persistence.get<CalibrationData | null>('calibration', null);
    return saved?.sensory ?? DEFAULT_SENSORY;
  });

  const [initialSpoons, setInitialSpoons] = useState<number>(() => {
    const saved = persistence.get<CalibrationData | null>('calibration', null);
    return saved?.initialSpoons ?? 7;
  });

  const [name, setName] = useState<string>(() => {
    const saved = persistence.get<CalibrationData | null>('calibration', null);
    return saved?.name ?? '';
  });

  const advance = useCallback(() => {
    setGate((prev) => {
      const next = Math.min(4, prev + 1) as OnboardingGate;
      if (next === 4) {
        const data: CalibrationData = {
          sensory,
          initialSpoons,
          name,
          completedAt: new Date().toISOString(),
        };
        persistence.set('calibration', data);
      }
      return next;
    });
  }, [sensory, initialSpoons, name]);

  const reset = useCallback(() => {
    persistence.remove('calibration');
    setGate(0);
    setSensory(DEFAULT_SENSORY);
    setInitialSpoons(7);
    setName('');
  }, []);

  const isComplete = gate === 4;

  return {
    gate,
    sensory,
    initialSpoons,
    name,
    isComplete,
    setSensory,
    setInitialSpoons,
    setName,
    advance,
    reset,
  };
}
