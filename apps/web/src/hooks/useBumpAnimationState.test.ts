/**
 * Test layer: unit
 * Behavior: useBumpAnimationState collects bump-animation events, tracks timing/progress, expires entries, and removes its listener on unmount.
 * Proof: Hook state assertions verify attackerId/defenderId entries, durationMs and impactFrameMs preservation, progress range and increase, expiration counts, simultaneous animations, and removeEventListener('bump-animation').
 * Validation: pnpm vitest run apps/web/src/hooks/useBumpAnimationState.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { BumpAnimationEntry } from '@dungeon/presenter';
import { useBumpAnimationState } from './useBumpAnimationState.js';

function createBumpEntry(overrides: Partial<BumpAnimationEntry> = {}): BumpAnimationEntry {
  return {
    attackerId: 'player-1' as any,
    defenderId: 'enemy-1' as any,
    attackerPos: { x: 10, y: 10 },
    defenderPos: { x: 11, y: 10 },
    durationMs: 150,
    impactFrameMs: 75,
    ...overrides,
  } satisfies BumpAnimationEntry;
}

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

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry(),
      }));
    });

    expect(result.current.animations).toHaveLength(1);
    expect(result.current.animations[0]!.attackerId).toBe('player-1');
    expect(result.current.animations[0]!.defenderId).toBe('enemy-1');
  });

  it('removes animation after the entry duration expires', () => {
    const { result } = renderHook(() => useBumpAnimationState(300));

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry({ durationMs: 90, impactFrameMs: 45 }),
      }));
    });

    expect(result.current.animations).toHaveLength(1);

    act(() => {
      vi.advanceTimersByTime(91);
    });

    expect(result.current.animations).toHaveLength(0);
  });

  it('falls back to the provided duration when legacy events omit timing', () => {
    const { result } = renderHook(() => useBumpAnimationState(120));

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: {
          attackerId: 'player-1',
          defenderId: 'enemy-1',
          attackerPos: { x: 10, y: 10 },
          defenderPos: { x: 11, y: 10 },
        } as BumpAnimationEntry,
      }));
    });

    act(() => {
      vi.advanceTimersByTime(121);
    });

    expect(result.current.animations).toHaveLength(0);
  });

  it('keeps impact frame timing from the event entry', () => {
    const { result } = renderHook(() => useBumpAnimationState(200));

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry({ durationMs: 180, impactFrameMs: 60 }),
      }));
    });

    expect(result.current.animations[0]!.durationMs).toBe(180);
    expect(result.current.animations[0]!.impactFrameMs).toBe(60);
  });

  it('provides progress values between 0 and 1', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry({ durationMs: 200, impactFrameMs: 100 }),
      }));
    });

    const animation = result.current.animations[0]!;
    expect(animation.progress).toBeGreaterThanOrEqual(0);
    expect(animation.progress).toBeLessThanOrEqual(1);
  });

  it('updates progress over time', () => {
    const { result } = renderHook(() => useBumpAnimationState(200));

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry({ durationMs: 200, impactFrameMs: 100 }),
      }));
    });

    const initialProgress = result.current.animations[0]!.progress;

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.animations[0]!.progress).toBeGreaterThan(initialProgress);
  });

  it('handles multiple simultaneous animations', () => {
    const { result } = renderHook(() => useBumpAnimationState(150));

    act(() => {
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry(),
      }));
      window.dispatchEvent(new CustomEvent('bump-animation', {
        detail: createBumpEntry({
          attackerId: 'enemy-2' as any,
          defenderId: 'player-1' as any,
          attackerPos: { x: 12, y: 12 },
          defenderPos: { x: 11, y: 12 },
        }),
      }));
    });

    expect(result.current.animations).toHaveLength(2);
  });

  it('cleans up the event listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useBumpAnimationState(150));

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('bump-animation', expect.any(Function));
  });
});
