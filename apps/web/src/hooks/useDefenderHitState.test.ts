import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { triggerDefenderHit, useDefenderHitState } from './useDefenderHitState.js';

describe('useDefenderHitState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('tracks the trigger and clear lifecycle', () => {
    const { result } = renderHook(() => useDefenderHitState());

    act(() => {
      triggerDefenderHit('enemy-1' as any, 80);
    });

    expect(result.current.has('enemy-1' as any)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(81);
    });

    expect(result.current.has('enemy-1' as any)).toBe(false);
  });

  it('refreshes the timer when the same defender is hit again', () => {
    const { result } = renderHook(() => useDefenderHitState());

    act(() => {
      triggerDefenderHit('enemy-1' as any, 50);
      vi.advanceTimersByTime(30);
      triggerDefenderHit('enemy-1' as any, 60);
      vi.advanceTimersByTime(30);
    });

    expect(result.current.has('enemy-1' as any)).toBe(true);

    act(() => {
      vi.advanceTimersByTime(31);
    });

    expect(result.current.has('enemy-1' as any)).toBe(false);
  });
});
