// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { persistence } from '../lib/persistence';
import { useOnboarding } from './useOnboarding';

describe('useOnboarding', () => {
  beforeEach(() => {
    persistence.clear();
  });

  it('exposes gate, sensory, initialSpoons, name, isComplete', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(typeof result.current.gate).toBe('number');
    expect(result.current.sensory).toBeDefined();
    expect(typeof result.current.initialSpoons).toBe('number');
    expect(typeof result.current.name).toBe('string');
    expect(typeof result.current.isComplete).toBe('boolean');
  });

  it('starts at gate 0 when no calibration saved', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.gate).toBe(0);
    expect(result.current.isComplete).toBe(false);
  });

  it('advance moves through gates and persists at gate 4', () => {
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.gate).toBe(0);
    act(() => { result.current.advance(); });
    expect(result.current.gate).toBe(1);
    act(() => { result.current.advance(); });
    expect(result.current.gate).toBe(2);
    act(() => { result.current.advance(); });
    expect(result.current.gate).toBe(3);
    act(() => { result.current.advance(); });
    expect(result.current.gate).toBe(4);
    expect(result.current.isComplete).toBe(true);
    expect(persistence.get('calibration', null)).not.toBeNull();
  });

  it('setSensory and setInitialSpoons and setName update state', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.setSensory({ ...result.current.sensory, motionScale: 0.5 }); });
    expect(result.current.sensory.motionScale).toBe(0.5);
    act(() => { result.current.setInitialSpoons(10); });
    expect(result.current.initialSpoons).toBe(10);
    act(() => { result.current.setName('Op'); });
    expect(result.current.name).toBe('Op');
  });

  it('reset clears calibration and returns to gate 0', () => {
    const { result } = renderHook(() => useOnboarding());
    act(() => { result.current.advance(); result.current.advance(); result.current.advance(); result.current.advance(); });
    expect(result.current.isComplete).toBe(true);
    act(() => { result.current.reset(); });
    expect(result.current.gate).toBe(0);
    expect(result.current.isComplete).toBe(false);
    expect(persistence.get('calibration', null)).toBeNull();
  });

  it('when calibration is saved, starts at gate 4', () => {
    persistence.set('calibration', {
      sensory: { motionScale: 0.7, glowIntensity: 0.6, soundEnabled: false, hapticEnabled: false },
      initialSpoons: 8,
      name: 'Test',
      completedAt: new Date().toISOString(),
    });
    const { result } = renderHook(() => useOnboarding());
    expect(result.current.gate).toBe(4);
    expect(result.current.isComplete).toBe(true);
  });
});
