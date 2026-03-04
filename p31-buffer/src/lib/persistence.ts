/**
 * persistence.ts — Local-first data storage
 * All data stays on device. Never transmitted without explicit consent.
 */

const PREFIX = 'p31_';

export function saveLocal<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (e) {
    console.warn('[persistence] Save failed:', key, e);
  }
}

export function loadLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function removeLocal(key: string): void {
  localStorage.removeItem(PREFIX + key);
}

export function hasLocal(key: string): boolean {
  return localStorage.getItem(PREFIX + key) !== null;
}

// Specific keys
export const KEYS = {
  ONBOARDING_PHASE: 'onboarding_phase',
  INTAKE_DATA: 'intake_data',
  CALIBRATION: 'calibration',
  GRAPH: 'graph',
  WALLET: 'wallet_address',
  COMPLETED: 'onboarding_complete',
} as const;
