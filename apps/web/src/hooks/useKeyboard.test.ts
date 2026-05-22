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

  it('blocks keyboard shortcuts while loading', () => {
    const sendCommand = vi.fn();
    useGameStore.setState({ sendCommand: sendCommand as any, loading: true });

    renderHook(() => useKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });

    expect(sendCommand).not.toHaveBeenCalled();
  });

  it('dispatches mapped commands when loading is false', () => {
    const sendCommand = vi.fn();
    useGameStore.setState({ sendCommand: sendCommand as any, loading: false });

    renderHook(() => useKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });

    expect(sendCommand).toHaveBeenCalledWith({ type: 'MOVE', direction: 'N' });
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

  it('dispatches sequential movement commands across store updates', () => {
    const sendCommand = vi.fn((command: unknown) => {
      const currentVersion = (useGameStore.getState().view as { version?: number } | null)?.version ?? 0;
      useGameStore.setState({
        view: {
          phase: 'dungeon',
          availableActions: [],
          version: currentVersion + 1,
        } as any,
        loading: false,
      });
      return command;
    });
    useGameStore.setState({
      sendCommand: sendCommand as any,
      loading: false,
      view: {
        phase: 'dungeon',
        availableActions: [],
        version: 0,
      } as any,
    });

    renderHook(() => useKeyboard());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    });

    expect(sendCommand.mock.calls).toEqual([
      [{ type: 'MOVE', direction: 'N' }],
      [{ type: 'MOVE', direction: 'E' }],
      [{ type: 'MOVE', direction: 'S' }],
    ]);
    expect((useGameStore.getState().view as { version?: number } | null)?.version).toBe(3);
  });
});
