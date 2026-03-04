/**
 * useOnboarding.ts — Onboarding state machine
 * Gates: wallet → intake → review → complete
 * Persists state across reloads via localStorage
 */
import { useState, useCallback, useMemo } from 'react';
import type { P31Graph } from '../types/graph';
import type { Calibration } from '../lib/intake-to-graph';
import { extractCalibration, intakeToGraph } from '../lib/intake-to-graph';
import { saveLocal, loadLocal, KEYS } from '../lib/persistence';
import { DEMO_GRAPH, DEMO_CALIBRATION } from '../lib/demo-graph';

export type OnboardingPhase = 'wallet' | 'intake' | 'review' | 'complete';

export interface OnboardingState {
  phase: OnboardingPhase;
  intakeData: Record<string, unknown>;
  graph: P31Graph;
  calibration: Calibration;
  walletAddress: string | null;
  // Actions
  updateField: (fieldId: string, value: unknown) => void;
  connectWallet: () => void;
  skipWallet: () => void;
  startIntake: () => void;
  finishIntake: () => void;
  signAndFinalize: () => void;
  skipSignAndFinalize: () => void;
}

export function useOnboarding(): OnboardingState {
  const isComplete = loadLocal(KEYS.COMPLETED, false);

  const [phase, setPhase] = useState<OnboardingPhase>(
    isComplete ? 'complete' : (loadLocal(KEYS.ONBOARDING_PHASE, 'wallet') as OnboardingPhase),
  );

  const [intakeData, setIntakeData] = useState<Record<string, unknown>>(
    loadLocal(KEYS.INTAKE_DATA, {}),
  );

  const [walletAddress, setWalletAddress] = useState<string | null>(
    loadLocal(KEYS.WALLET, null),
  );

  const [graph, setGraph] = useState<P31Graph>(
    isComplete ? loadLocal(KEYS.GRAPH, DEMO_GRAPH) : DEMO_GRAPH,
  );

  const [calibration, setCalibration] = useState<Calibration>(
    isComplete ? loadLocal(KEYS.CALIBRATION, DEMO_CALIBRATION) : DEMO_CALIBRATION,
  );

  const goTo = useCallback((p: OnboardingPhase) => {
    setPhase(p);
    saveLocal(KEYS.ONBOARDING_PHASE, p);
  }, []);

  const updateField = useCallback((fieldId: string, value: unknown) => {
    setIntakeData(prev => {
      const next = { ...prev, [fieldId]: value };
      saveLocal(KEYS.INTAKE_DATA, next);
      return next;
    });
  }, []);

  const connectWallet = useCallback(() => {
    // Stub: in production, trigger wallet connect modal
    const addr = '0x' + 'demo'.padStart(40, '0');
    setWalletAddress(addr);
    saveLocal(KEYS.WALLET, addr);
    goTo('intake');
  }, [goTo]);

  const skipWallet = useCallback(() => {
    setWalletAddress(null);
    saveLocal(KEYS.WALLET, null);
  }, []);

  const startIntake = useCallback(() => goTo('intake'), [goTo]);

  const finishIntake = useCallback(() => {
    // Build calibration and graph from intake answers
    const cal = extractCalibration(intakeData);
    const g = intakeToGraph(intakeData, cal);
    setCalibration(cal);
    setGraph(g);
    saveLocal(KEYS.CALIBRATION, cal);
    saveLocal(KEYS.GRAPH, g);
    goTo('review');
  }, [intakeData, goTo]);

  const finalize = useCallback(() => {
    saveLocal(KEYS.COMPLETED, true);
    goTo('complete');
  }, [goTo]);

  const signAndFinalize = useCallback(() => {
    // Stub: in production, sign intake hash with wallet
    finalize();
  }, [finalize]);

  const skipSignAndFinalize = useCallback(() => {
    finalize();
  }, [finalize]);

  return {
    phase,
    intakeData,
    graph,
    calibration,
    walletAddress,
    updateField,
    connectWallet,
    skipWallet,
    startIntake,
    finishIntake,
    signAndFinalize,
    skipSignAndFinalize,
  };
}
