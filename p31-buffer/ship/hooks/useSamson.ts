import { useState, useMemo, useCallback } from 'react';

const MARK1 = 0.349;
const HISTORY_SIZE = 20;

export interface SamsonState {
  H: number;
  error: number;
  pTerm: 'over-actualized' | 'nominal' | 'under-actualized';
  drift: 'nominal' | 'looping' | 'escalating';
  burnout: 'ok' | 'warning' | 'critical';
  aiTemp: number;
  zScore: number;
  tension: number;
  addScore: (voltage: number) => void;
}

export function useSamson(spoons: number, maxSpoons: number): SamsonState {
  const [history, setHistory] = useState<number[]>([]);

  const H = useMemo(() => {
    if (history.length === 0) return MARK1;
    let wSum = 0, vSum = 0;
    for (let i = 0; i < history.length; i++) {
      const w = Math.pow(0.9, history.length - 1 - i);
      vSum += (history[i] / 10) * w;
      wSum += w;
    }
    return vSum / wSum;
  }, [history]);

  const error = H - MARK1;

  const pTerm = useMemo((): SamsonState['pTerm'] => {
    if (error > 0.15) return 'over-actualized';
    if (error < -0.15) return 'under-actualized';
    return 'nominal';
  }, [error]);

  const drift = useMemo((): SamsonState['drift'] => {
    if (history.length < 3) return 'nominal';
    const recent = history.slice(-5);
    const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (avg > 6) return 'escalating';
    if (recent.every((v, i, a) => i === 0 || Math.abs(v - a[i - 1]) < 0.5)) return 'looping';
    return 'nominal';
  }, [history]);

  const burnout = useMemo((): SamsonState['burnout'] => {
    const pct = maxSpoons > 0 ? (spoons / maxSpoons) * 100 : 100;
    if (pct < 15) return 'critical';
    if (pct < 30) return 'warning';
    return 'ok';
  }, [spoons, maxSpoons]);

  const aiTemp = useMemo(() => {
    let t = 0.7;
    if (pTerm === 'over-actualized') t += 0.15;
    if (pTerm === 'under-actualized') t -= 0.15;
    if (drift === 'looping') t += 0.2;
    if (drift === 'escalating') t -= 0.1;
    if (burnout === 'critical') t -= 0.2;
    return Math.max(0.1, Math.min(1.0, +t.toFixed(2)));
  }, [pTerm, drift, burnout]);

  const zScore = useMemo(() => {
    if (history.length < 2) return 0;
    const mean = history.reduce((a, b) => a + b, 0) / history.length;
    const std = Math.sqrt(history.reduce((a, b) => a + (b - mean) ** 2, 0) / history.length) || 1;
    return +((H - MARK1) / (std / Math.sqrt(history.length))).toFixed(2);
  }, [H, history]);

  const tension = useMemo(() => {
    let t = 0;
    t += Math.min(0.3, Math.abs(error));
    if (drift === 'looping') t += 0.15;
    if (drift === 'escalating') t += 0.3;
    if (burnout === 'warning') t += 0.15;
    if (burnout === 'critical') t += 0.3;
    return Math.min(1.0, t);
  }, [error, drift, burnout]);

  const addScore = useCallback((voltage: number) => {
    setHistory(prev => [...prev.slice(-(HISTORY_SIZE - 1)), voltage]);
  }, []);

  return { H, error, pTerm, drift, burnout, aiTemp, zScore, tension, addScore };
}
