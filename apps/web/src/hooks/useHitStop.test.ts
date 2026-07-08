/**
 * Test layer: unit
 * Behavior: UseHitStop covers useHitStop; tracks the trigger and clear lifecycle; stays paused until overlapping hit stops have both cleared.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/hooks/useHitStop.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { triggerHitStop, useHitStop } from './useHitStop.js';

describe('useHitStop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('tracks the trigger and clear lifecycle', () => {
    const { result } = renderHook(() => useHitStop());

    expect(result.current.isPaused).toBe(false);

    act(() => {
      triggerHitStop(80);
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      vi.advanceTimersByTime(81);
    });

    expect(result.current.isPaused).toBe(false);
  });

  it('stays paused until overlapping hit stops have both cleared', () => {
    const { result } = renderHook(() => useHitStop());

    act(() => {
      triggerHitStop(100);
      triggerHitStop(50);
    });

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(result.current.isPaused).toBe(true);

    act(() => {
      vi.advanceTimersByTime(41);
    });

    expect(result.current.isPaused).toBe(false);
  });
});
