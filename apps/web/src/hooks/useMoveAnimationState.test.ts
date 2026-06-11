import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MoveAnimationEntry } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';
import { applyMoveStyleEasing } from '../animations/move-style-profiles.js';
import { dispatchWalkContinuation } from '../animation-runtime/walk-continuation-bus.js';
import {
  clearMoveAnimationSubscribers,
  registerMoveAnimation,
  subscribeMoveAnimation,
  useMoveAnimationState,
} from './useMoveAnimationState.js';

function createMoveEntry(overrides: Partial<MoveAnimationEntry> = {}): MoveAnimationEntry {
  return {
    entityId: 'player-1' as any,
    fromPos: { x: 0, y: 0 },
    toPos: { x: 1, y: 0 },
    style: 'step',
    durationMs: 100,
    ...overrides,
  } satisfies MoveAnimationEntry;
}

describe('useMoveAnimationState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    clearMoveAnimationSubscribers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('carries the rendered offset into a superseding move for the same entity', async () => {
    const { result } = renderHook(() => useMoveAnimationState());

    act(() => {
      dispatchWalkContinuation({ entityId: 'player-1', continuing: true });
      window.dispatchEvent(new CustomEvent('move-animation', {
        detail: createMoveEntry(),
      }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('move-animation', {
        detail: createMoveEntry({
          fromPos: { x: 1, y: 0 },
          toPos: { x: 2, y: 0 },
        }),
      }));
    });

    const expectedCarryX = -CELL_SIZE * (1 - applyMoveStyleEasing('step', 0.5));
    const active = result.current.animations[0]!;

    expect(result.current.animations).toHaveLength(1);
    expect(active.walkPhase).toBe('middle');
    expect(active.fromOffsetPx.x).toBeCloseTo(expectedCarryX, 4);
    expect(active.fromOffsetPx.y).toBeCloseTo(0, 4);
  });

  it('does not schedule an idle animation frame loop', () => {
    renderHook(() => useMoveAnimationState());

    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not carry offset from a completed animation', async () => {
    const { result } = renderHook(() => useMoveAnimationState());

    act(() => {
      window.dispatchEvent(new CustomEvent('move-animation', {
        detail: createMoveEntry(),
      }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(101);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('move-animation', {
        detail: createMoveEntry({
          fromPos: { x: 1, y: 0 },
          toPos: { x: 2, y: 0 },
        }),
      }));
    });

    const active = result.current.animations[0]!;

    expect(active.fromOffsetPx).toEqual({ x: 0, y: 0 });
  });

  it('retargets the active step phase while continuation is still undecided', () => {
    const { result } = renderHook(() => useMoveAnimationState());

    act(() => {
      dispatchWalkContinuation({ entityId: 'player-1', continuing: true });
      window.dispatchEvent(new CustomEvent('move-animation', {
        detail: createMoveEntry(),
      }));
    });

    expect(result.current.animations[0]?.walkPhase).toBe('start');

    act(() => {
      dispatchWalkContinuation({ entityId: 'player-1', continuing: false });
    });

    expect(result.current.animations[0]?.walkPhase).toBe('single');
  });

  it('dispatches once for duplicate subscriptions of the same callback', () => {
    const subscriber = vi.fn();
    const unsubscribeFirst = subscribeMoveAnimation(subscriber);
    const unsubscribeSecond = subscribeMoveAnimation(subscriber);

    registerMoveAnimation(createMoveEntry());
    expect(subscriber).toHaveBeenCalledTimes(1);

    unsubscribeFirst();
    registerMoveAnimation(createMoveEntry({ fromPos: { x: 1, y: 0 }, toPos: { x: 2, y: 0 } }));
    expect(subscriber).toHaveBeenCalledTimes(2);

    unsubscribeSecond();
    registerMoveAnimation(createMoveEntry({ fromPos: { x: 2, y: 0 }, toPos: { x: 3, y: 0 } }));
    expect(subscriber).toHaveBeenCalledTimes(2);
  });
});
