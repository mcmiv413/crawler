/**
 * Test layer: unit
 * Behavior: UseKeyboard covers useKeyboard; blocks non-movement shortcuts while loading; dispatches wait when loading is false.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/hooks/useKeyboard.test.ts
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameStore } from '../store/game-store.js';
import { useKeyboard } from './useKeyboard.js';

describe('useKeyboard', () => {
  beforeEach(() => {
    act(() => {
      useGameStore.setState({
        view: {
          phase: 'dungeon',
          availableActions: [],
        } as any,
        loading: false,
        sendCommand: vi.fn() as any,
      });
    });
  });

  afterEach(() => {
    act(() => {
      useGameStore.setState({
        view: null,
        loading: false,
      });
    });
    vi.restoreAllMocks();
  });

  it('blocks non-movement shortcuts while loading', () => {
    const sendCommand = vi.fn();
    useGameStore.setState({ sendCommand: sendCommand as any, loading: true });

    renderHook(() => useKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.' }));
    });

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('dispatches wait when loading is false', () => {
    const sendCommand = vi.fn();
    useGameStore.setState({ sendCommand: sendCommand as any, loading: false });

    renderHook(() => useKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: '.' }));
    });

    expect(sendCommand).toHaveBeenCalledWith({ type: 'WAIT' });
  });

  it('ignores movement keys so the walk controller owns pacing', () => {
    const sendCommand = vi.fn();
    useGameStore.setState({ sendCommand: sendCommand as any, loading: false });

    renderHook(() => useKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('keeps a single keydown listener across store updates', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useKeyboard());

    act(() => {
      useGameStore.setState({
        view: {
          phase: 'dungeon',
          availableActions: [{ type: 'attack', enabled: true }],
        } as any,
        loading: true,
      });
    });

    act(() => {
      useGameStore.setState({
        view: {
          phase: 'dungeon',
          availableActions: [],
        } as any,
        loading: false,
      });
    });

    expect(addEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'keydown')).toHaveLength(1);
    expect(removeEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'keydown')).toHaveLength(0);

    unmount();

    expect(removeEventListenerSpy.mock.calls.filter(([eventName]) => eventName === 'keydown')).toHaveLength(1);
  });
});
