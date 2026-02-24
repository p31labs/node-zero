import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import 'fake-indexeddb/auto';

// Mock connection-manager to avoid real fetch calls
vi.mock('../lib/connection-manager', () => ({
  connectionManager: {
    connectWeb3: vi.fn().mockResolvedValue(false),
    getService: vi.fn(),
  },
}));

import { useOnboarding } from './useOnboarding';
import { onboardingDb } from '../lib/onboarding-store';

describe('useOnboarding', () => {
  beforeEach(async () => {
    await onboardingDb.onboarding.clear();
    vi.clearAllMocks();
  });

  it('starts in loading phase', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.phase).toBe('loading');
  });

  it('transitions to wallet phase when no completed onboarding', async () => {
    const { result } = renderHook(() => useOnboarding());
    // Wait for async check
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });
    expect(result.current.phase).toBe('wallet');
  });

  it('updateField adds data and recomputes liveGraph', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });

    act(() => { result.current.updateField('name', 'Will'); });
    expect(result.current.intakeData.name).toBe('Will');
    expect(result.current.liveGraph.nodes.length).toBeGreaterThan(0);
  });

  it('liveGraph has correct node for answered field', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });

    act(() => { result.current.updateField('energy_baseline', 6); });
    const node = result.current.liveGraph.nodes.find(n => n.id === 'intake:energy_baseline');
    expect(node).toBeDefined();
    expect(node!.axis).toBe('B');
  });

  it('calibration reflects current answers', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });

    act(() => { result.current.updateField('energy_baseline', 5); });
    expect(result.current.calibration.initialSpoons).toBe(5);
  });

  it('skipWallet transitions to intake phase', async () => {
    const { result } = renderHook(() => useOnboarding());
    await act(async () => { await new Promise(r => setTimeout(r, 100)); });

    act(() => { result.current.skipWallet(); });
    expect(result.current.phase).toBe('intake');
  });
});
