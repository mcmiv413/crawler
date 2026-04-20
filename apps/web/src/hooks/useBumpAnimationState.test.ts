import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { useBumpAnimationState } from './useBumpAnimationState.js';

describe('useBumpAnimationState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('returns empty animations initially', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));
    expect(result.current.animations).toEqual([]);
  });

  it('tracks active bump animations', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.animations).toHaveLength(1);
    expect(result.current.animations[0].attackerId).toBe('player-1');
    expect(result.current.animations[0].defenderId).toBe('enemy-1');
  });

  it('removes animation after duration expires', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.animations).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(151);
    });

    expect(result.current.animations).toHaveLength(0);
  });

  it('provides progress value (0 to 1) for animation frame updates', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    const animation = result.current.animations[0];
    expect(animation.progress).toBeDefined();
    expect(animation.progress).toBeGreaterThanOrEqual(0);
    expect(animation.progress).toBeLessThanOrEqual(1);
  });

  it('updates progress over time', () => {
    const { result } = renderHook(() => useBumpAnimationState(200));

    const event = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });

    act(() => {
      window.dispatchEvent(event);
    });

    const initialProgress = result.current.animations[0].progress;

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const midProgress = result.current.animations[0].progress;
    expect(midProgress).toBeGreaterThan(initialProgress);
  });

  it('handles multiple simultaneous animations', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));

    const event1 = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'player-1',
        defenderId: 'enemy-1',
        attackerPos: { x: 10, y: 10 },
        defenderPos: { x: 11, y: 10 },
      } as BumpAnimationEntry,
    });

    const event2 = new CustomEvent('bump-animation', {
      detail: {
        attackerId: 'enemy-2',
        defenderId: 'player-1',
        attackerPos: { x: 12, y: 12 },
        defenderPos: { x: 11, y: 12 },
      } as BumpAnimationEntry,
    });

    act(() => {
      window.dispatchEvent(event1);
      window.dispatchEvent(event2);
    });

    expect(result.current.animations).toHaveLength(2);
  });

  it('cleans up event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBumpAnimationState(150));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('bump-animation', expect.any(Function));
  });
});
