/**
 * Test layer: unit
 * Behavior: UseAutoWalk covers useAutoWalk; cancels an active path on any keydown; also cancels auto-walk when movement input takes over.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/hooks/useAutoWalk.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameStore } from '../store/game-store.js';
import { useAutoWalk } from './useAutoWalk.js';

describe('useAutoWalk', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.getState().resetGame();
      useGameStore.setState({
        autoWalkPath: [],
        autoWalkKnownEnemyIds: new Set(),
      });
    });
  });

  afterEach(() => {
    act(() => {
      useGameStore.getState().resetGame();
    });
    vi.restoreAllMocks();
  });

  it('cancels an active path on any keydown', () => {
    renderHook(() => useAutoWalk());

    act(() => {
      useGameStore.setState({
        autoWalkPath: [{ x: 2, y: 1 }],
        autoWalkKnownEnemyIds: new Set(['enemy-1']),
      });
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(useGameStore.getState().autoWalkPath).toEqual([]);
  });

  it('also cancels auto-walk when movement input takes over', () => {
    renderHook(() => useAutoWalk());

    act(() => {
      useGameStore.setState({
        autoWalkPath: [{ x: 2, y: 1 }],
        autoWalkKnownEnemyIds: new Set(['enemy-1']),
      });
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });

    expect(useGameStore.getState().autoWalkPath).toEqual([]);
  });
});
