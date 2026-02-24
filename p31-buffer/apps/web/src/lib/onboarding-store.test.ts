import { describe, it, expect, beforeEach } from 'vitest';

// Install fake-indexeddb for testing: npm i -D fake-indexeddb
// Then at top of test:
import 'fake-indexeddb/auto';

import {
  saveProgress,
  loadProgress,
  finalizeOnboarding,
  hasCompletedOnboarding,
  getCompletedOnboarding,
  onboardingDb,
} from './onboarding-store';

describe('onboarding-store', () => {
  beforeEach(async () => {
    // Clear the database between tests
    await onboardingDb.onboarding.clear();
  });

  describe('saveProgress / loadProgress', () => {
    it('saves and loads intake data', async () => {
      const data = { name: 'Will', energy_baseline: 8 };
      await saveProgress(data);
      const loaded = await loadProgress();
      expect(loaded).toEqual(data);
    });

    it('returns null when no progress saved', async () => {
      const loaded = await loadProgress();
      expect(loaded).toBeNull();
    });

    it('overwrites previous progress', async () => {
      await saveProgress({ name: 'Will' });
      await saveProgress({ name: 'Will', email: 'w@p31.io' });
      const loaded = await loadProgress();
      expect(loaded).toEqual({ name: 'Will', email: 'w@p31.io' });
    });
  });

  describe('finalizeOnboarding', () => {
    it('stores finalized record with completedAt', async () => {
      const data = { name: 'Will' };
      const cal = { initialSpoons: 8 };
      await finalizeOnboarding(data, cal);

      const record = await getCompletedOnboarding();
      expect(record).toBeDefined();
      expect(record!.intakeData).toEqual(data);
      expect(record!.calibration).toEqual(cal);
      expect(record!.completedAt).toBeGreaterThan(0);
    });

    it('clears the "current" draft after finalization', async () => {
      await saveProgress({ name: 'draft' });
      await finalizeOnboarding({ name: 'final' }, {});

      const draft = await loadProgress();
      expect(draft).toBeNull();
    });

    it('stores wallet address and signature when provided', async () => {
      await finalizeOnboarding(
        { name: 'Will' },
        {},
        '0xABC123',
        '0xSIG456',
      );

      const record = await getCompletedOnboarding();
      expect(record!.walletAddress).toBe('0xABC123');
      expect(record!.signature).toBe('0xSIG456');
    });
  });

  describe('hasCompletedOnboarding', () => {
    it('returns false when no completed records exist', async () => {
      const result = await hasCompletedOnboarding();
      expect(result).toBe(false);
    });

    it('returns true after finalization', async () => {
      await finalizeOnboarding({ name: 'Will' }, {});
      const result = await hasCompletedOnboarding();
      expect(result).toBe(true);
    });
  });
});
