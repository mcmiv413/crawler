import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCombatIndicatorState } from './useCombatIndicatorState.js';

function emitCombatIndicator(detail: {
  x: number;
  y: number;
  text: string;
  type: 'damage' | 'heal' | 'status' | 'gold';
}) {
  window.dispatchEvent(new CustomEvent('combat-indicator', { detail }));
}

describe('useCombatIndicatorState', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('collects and expires combat indicators on the shared channel', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCombatIndicatorState(500));

    act(() => {
      emitCombatIndicator({ x: 4, y: 5, text: '12', type: 'damage' });
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toMatchObject({
      x: 4,
      y: 5,
      text: '12',
      type: 'damage',
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toEqual([]);
  });

  it('keeps combat indicators visible until the configured fade duration elapses', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useCombatIndicatorState(750));

    act(() => {
      emitCombatIndicator({ x: 4, y: 5, text: 'miss', type: 'damage' });
    });

    act(() => {
      vi.advanceTimersByTime(749);
    });

    expect(result.current).toHaveLength(1);
    expect(result.current[0]?.text).toBe('miss');

    act(() => {
      vi.advanceTimersByTime(1);
    });

    expect(result.current).toEqual([]);
  });

  it('clears labels and ignores new events when disabled', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ enabled }) => useCombatIndicatorState(500, enabled),
      { initialProps: { enabled: true } },
    );

    act(() => {
      emitCombatIndicator({ x: 1, y: 2, text: '+5', type: 'heal' });
    });
    expect(result.current).toHaveLength(1);

    rerender({ enabled: false });
    expect(result.current).toEqual([]);

    act(() => {
      emitCombatIndicator({ x: 1, y: 2, text: '+7', type: 'heal' });
      vi.advanceTimersByTime(500);
    });

    expect(result.current).toEqual([]);
  });
});
