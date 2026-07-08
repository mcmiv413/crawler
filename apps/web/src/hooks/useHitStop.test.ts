/**
 * Test layer: unit
 * Behavior: useHitStop toggles pause state for hit-stop durations and keeps overlapping hit stops paused until the longest timer clears.
 * Proof: Asserts isPaused changes false to true to false around triggerHitStop(80) and stays true after 60 ms of overlapping 100/50 ms stops before clearing after 101 ms.
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
