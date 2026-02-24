import { useState, useEffect, useCallback, useMemo } from 'react';
import { intakeToGraph, extractCalibration, type Calibration } from '../lib/intake-to-graph';
import {
  saveProgress,
  loadProgress,
  finalizeOnboarding,
  hasCompletedOnboarding,
} from '../lib/onboarding-store';
import { connectionManager } from '../lib/connection-manager';
import type { P31Graph } from '@p31-buffer/graph-schema';

export type OnboardingPhase = 'loading' | 'wallet' | 'intake' | 'review' | 'complete';

export function useOnboarding() {
  const [phase, setPhase] = useState<OnboardingPhase>('loading');
  const [intakeData, setIntakeData] = useState<Record<string, unknown>>({});
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await hasCompletedOnboarding();
      if (cancelled) return;
      if (done) {
        setPhase('complete');
        return;
      }
      const saved = await loadProgress();
      if (cancelled) return;
      if (saved) setIntakeData(saved);
      setPhase('wallet');
    })();
    return () => { cancelled = true; };
  }, []);

  const liveGraph: P31Graph = useMemo(() => intakeToGraph(intakeData), [intakeData]);
  const calibration: Calibration = useMemo(() => extractCalibration(intakeData), [intakeData]);

  const updateField = useCallback((fieldId: string, value: unknown) => {
    setIntakeData(prev => {
      const next = { ...prev, [fieldId]: value };
      saveProgress(next).catch(() => {});
      return next;
    });
  }, []);

  const connectWallet = useCallback(async () => {
    const success = await connectionManager.connectWeb3();
    if (success) {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent).detail;
        setWalletAddress(detail);
        window.removeEventListener('p31:web3-connected', handler);
      };
      window.addEventListener('p31:web3-connected', handler);
    }
  }, []);

  const skipWallet = useCallback(() => setPhase('intake'), []);
  const startIntake = useCallback(() => setPhase('intake'), []);
  const finishIntake = useCallback(() => setPhase('review'), []);

  const signAndFinalize = useCallback(async () => {
    let sig: string | undefined;
    if (walletAddress) {
      try {
        const ethereum = (window as unknown as { ethereum?: { request: (p: { method: string; params: unknown[] }) => Promise<string> } }).ethereum;
        if (ethereum) {
          const hash = JSON.stringify(intakeData);
          sig = await ethereum.request({ method: 'personal_sign', params: [hash, walletAddress] });
          setSignature(sig ?? null);
        }
      } catch {
        // user declined
      }
    }
    await finalizeOnboarding(intakeData, calibration, walletAddress ?? undefined, sig);
    setPhase('complete');
  }, [intakeData, calibration, walletAddress]);

  const skipSignAndFinalize = useCallback(async () => {
    await finalizeOnboarding(intakeData, calibration);
    setPhase('complete');
  }, [intakeData, calibration]);

  const resetOnboarding = useCallback(() => {
    setIntakeData({});
    setWalletAddress(null);
    setSignature(null);
    setPhase('wallet');
  }, []);

  return {
    phase,
    setPhase,
    intakeData,
    updateField,
    liveGraph,
    calibration,
    walletAddress,
    signature,
    connectWallet,
    skipWallet,
    startIntake,
    finishIntake,
    signAndFinalize,
    skipSignAndFinalize,
    resetOnboarding,
  };
}
