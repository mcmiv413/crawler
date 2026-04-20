import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedVisibility } from './useDelayedVisibility.js';

describe('useDelayedVisibility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('returns false initially when trigger is false', () => {
    const { result } = renderHook(() => useDelayedVisibility(false, 2000));
    expect(result.current.isVisible).toBe(false);
  });

  it('returns false immediately when trigger is true (within delay)', () => {
    const { result } = renderHook(() => useDelayedVisibility(true, 2000));
    expect(result.current.isVisible).toBe(false);
  });

  it('returns true after delay when trigger is true', () => {
    const { result } = renderHook(() => useDelayedVisibility(true, 2000));

    expect(result.current.isVisible).toBe(false);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isVisible).toBe(true);
  });

  it('resets visibility when trigger becomes false', () => {
    const { result, rerender } = renderHook(
      ({ trigger, delay }: { trigger: boolean; delay: number }) =>
        useDelayedVisibility(trigger, delay),
      {
        initialProps: { trigger: true, delay: 2000 },
      }
    );

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.isVisible).toBe(true);

    rerender({ trigger: false, delay: 2000 });

    expect(result.current.isVisible).toBe(false);
  });

  it('clears timers on unmount', () => {
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    const { unmount } = renderHook(() => useDelayedVisibility(true, 2000));

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});
