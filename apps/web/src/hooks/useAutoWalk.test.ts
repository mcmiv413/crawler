import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGameStore } from '../store/game-store.js';
import { emitQueueDrained, setQueueDraining } from '../animation-runtime/animation-queue-bus.js';
import { useAutoWalk } from './useAutoWalk.js';

function createDungeonView(
  x: number,
  y: number,
  health: number = 50,
  entities: readonly { readonly id: string; readonly type: string; readonly x: number; readonly y: number }[] = [],
): any {
  return {
    phase: 'dungeon',
    player: {
      health,
    },
    map: {
      playerPosition: { x, y },
      entities,
    },
  };
}

function movePosition(
  position: { readonly x: number; readonly y: number },
  direction: string,
): { readonly x: number; readonly y: number } {
  switch (direction) {
    case 'N':
      return { x: position.x, y: position.y - 1 };
    case 'S':
      return { x: position.x, y: position.y + 1 };
    case 'E':
      return { x: position.x + 1, y: position.y };
    case 'W':
      return { x: position.x - 1, y: position.y };
    case 'NE':
      return { x: position.x + 1, y: position.y - 1 };
    case 'NW':
      return { x: position.x - 1, y: position.y - 1 };
    case 'SE':
      return { x: position.x + 1, y: position.y + 1 };
    case 'SW':
      return { x: position.x - 1, y: position.y + 1 };
    default:
      return position;
  }
}

describe('useAutoWalk', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__ = true;
    setQueueDraining(false);
    act(() => {
      useGameStore.getState().resetGame();
      useGameStore.setState({
        view: createDungeonView(1, 1),
        loading: false,
        error: null,
        autoWalkPath: [],
        autoWalkKnownEnemyIds: new Set(),
      });
    });
  });

  afterEach(() => {
    act(() => {
      setQueueDraining(false);
      emitQueueDrained();
      useGameStore.getState().resetGame();
    });
    globalThis.__DUNGEON_BEAT_SCHEDULER_OVERRIDE__ = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waits for the queue to drain before sending the next auto-walk step', async () => {
    let callCount = 0;
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const currentPosition = useGameStore.getState().view?.map?.playerPosition ?? { x: 1, y: 1 };
      const nextPosition = movePosition(currentPosition, command.direction);
      callCount += 1;

      useGameStore.setState({
        view: createDungeonView(nextPosition.x, nextPosition.y),
      });

      if (callCount === 1) {
        setQueueDraining(true);
      }

      return Promise.resolve();
    });

    renderHook(() => useAutoWalk());

    act(() => {
      useGameStore.setState({
        sendCommand: sendCommand as any,
        view: createDungeonView(1, 1),
        autoWalkPath: [{ x: 2, y: 1 }, { x: 3, y: 1 }],
        autoWalkKnownEnemyIds: new Set(),
      });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendCommand.mock.calls).toEqual([
      [{ type: 'MOVE', direction: 'E' }],
    ]);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);

    act(() => {
      setQueueDraining(false);
      emitQueueDrained();
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendCommand.mock.calls).toEqual([
      [{ type: 'MOVE', direction: 'E' }],
      [{ type: 'MOVE', direction: 'E' }],
    ]);
    expect(useGameStore.getState().autoWalkPath).toEqual([]);
  });

  it('pauses auto-walk when a newly visible enemy appears after a step', async () => {
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const currentPosition = useGameStore.getState().view?.map?.playerPosition ?? { x: 1, y: 1 };
      const nextPosition = movePosition(currentPosition, command.direction);

      useGameStore.setState({
        view: createDungeonView(nextPosition.x, nextPosition.y, 50, [{
          id: 'enemy-new',
          type: 'enemy',
          x: nextPosition.x + 1,
          y: nextPosition.y,
        }]),
      });

      return Promise.resolve();
    });

    renderHook(() => useAutoWalk());

    act(() => {
      useGameStore.setState({
        sendCommand: sendCommand as any,
        view: createDungeonView(1, 1),
        autoWalkPath: [{ x: 2, y: 1 }, { x: 3, y: 1 }],
        autoWalkKnownEnemyIds: new Set(),
      });
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(sendCommand.mock.calls).toEqual([
      [{ type: 'MOVE', direction: 'E' }],
    ]);
    expect(useGameStore.getState().autoWalkPath).toEqual([]);
  });
});
