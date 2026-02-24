/**
 * Onboarding state persisted in Dexie. Survives reloads, works offline.
 */
import Dexie, { type Table } from 'dexie';

export interface OnboardingRecord {
  id: string;
  walletAddress?: string;
  intakeData: Record<string, unknown>;
  calibration?: unknown;
  completedAt?: number;
  signedAt?: number;
  signature?: string;
  version: string;
}

class OnboardingDB extends Dexie {
  onboarding!: Table<OnboardingRecord>;

  constructor() {
    super('p31-onboarding');
    this.version(1).stores({
      onboarding: 'id, walletAddress, completedAt',
    });
  }
}

export const onboardingDb = new OnboardingDB();

export async function saveProgress(data: Record<string, unknown>): Promise<void> {
  await onboardingDb.onboarding.put({
    id: 'current',
    intakeData: data,
    version: '1.0',
  });
}

export async function loadProgress(): Promise<Record<string, unknown> | null> {
  const record = await onboardingDb.onboarding.get('current');
  return record?.intakeData ?? null;
}

export async function finalizeOnboarding(
  data: Record<string, unknown>,
  calibration: unknown,
  walletAddress?: string,
  signature?: string,
): Promise<void> {
  await onboardingDb.onboarding.put({
    id: walletAddress ?? 'local',
    walletAddress,
    intakeData: data,
    calibration,
    completedAt: Date.now(),
    signedAt: signature ? Date.now() : undefined,
    signature,
    version: '1.0',
  });
  await onboardingDb.onboarding.delete('current');
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const count = await onboardingDb.onboarding
    .where('completedAt')
    .above(0)
    .count();
  return count > 0;
}

export async function getCompletedOnboarding(): Promise<OnboardingRecord | null> {
  const records = await onboardingDb.onboarding
    .where('completedAt')
    .above(0)
    .sortBy('completedAt');
  return records.length > 0 ? records[records.length - 1] ?? null : null;
}
