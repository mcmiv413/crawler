import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { MoveAnimationEntry } from '@dungeon/presenter';
import { STEP_WALK_BOUNDARY_PROGRESS } from '../animations/move-style-profiles.js';
import { useGameStore } from '../store/game-store.js';
import { useWalkController } from './useWalkController.js';

const STEP_DURATION_MS = 140;
const BOUNDARY_MS = STEP_DURATION_MS * STEP_WALK_BOUNDARY_PROGRESS;

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

function emitPlayerMove(
  fromPos: { readonly x: number; readonly y: number },
  toPos: { readonly x: number; readonly y: number },
): void {
  window.dispatchEvent(new CustomEvent<MoveAnimationEntry>('move-animation', {
    detail: {
      entityId: 'player-1' as any,
      fromPos,
      toPos,
      style: 'step',
      durationMs: STEP_DURATION_MS,
    },
  }));
}

describe('useWalkController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
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
      useGameStore.getState().resetGame();
    });
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('continues held movement at the step boundary instead of raw key repeat', async () => {
    let currentPosition = { x: 1, y: 1 };
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const fromPos = currentPosition;
      currentPosition = movePosition(currentPosition, command.direction);
      useGameStore.setState({
        view: createDungeonView(currentPosition.x, currentPosition.y),
      });
      emitPlayerMove(fromPos, currentPosition);
    });
    useGameStore.setState({ sendCommand: sendCommand as any });

    renderHook(() => useWalkController());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });

    expect(sendCommand.mock.calls).toEqual([
      [{ type: 'MOVE', direction: 'E' }],
    ]);

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS - 1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(2);

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight' }));
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS + 1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(2);
  });

  it('waits for loading to clear after the boundary before sending the next held step', async () => {
    let currentPosition = { x: 1, y: 1 };
    let callCount = 0;
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const fromPos = currentPosition;
      currentPosition = movePosition(currentPosition, command.direction);
      callCount += 1;
      useGameStore.setState({
        view: createDungeonView(currentPosition.x, currentPosition.y),
        loading: callCount === 1,
      });
      emitPlayerMove(fromPos, currentPosition);
    });
    useGameStore.setState({ sendCommand: sendCommand as any });

    renderHook(() => useWalkController());

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    });

    await act(async () => {
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS + 1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);

    act(() => {
      useGameStore.setState({ loading: false });
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(sendCommand).toHaveBeenCalledTimes(2);
  });

  it('advances auto-walk at the step boundary and clears the path when complete', async () => {
    let currentPosition = { x: 1, y: 1 };
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const fromPos = currentPosition;
      currentPosition = movePosition(currentPosition, command.direction);
      useGameStore.setState({
        view: createDungeonView(currentPosition.x, currentPosition.y),
      });
      emitPlayerMove(fromPos, currentPosition);
    });
    useGameStore.setState({ sendCommand: sendCommand as any });

    renderHook(() => useWalkController());

    act(() => {
      useGameStore.setState({
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
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS + 1);
    });

    expect(sendCommand.mock.calls).toEqual([
      [{ type: 'MOVE', direction: 'E' }],
      [{ type: 'MOVE', direction: 'E' }],
    ]);
    expect(useGameStore.getState().autoWalkPath).toEqual([]);
  });

  it('cancels auto-walk when the next step is blocked', async () => {
    const currentPosition = { x: 1, y: 1 };
    const sendCommand = vi.fn(() => {
      useGameStore.setState({
        view: createDungeonView(currentPosition.x, currentPosition.y),
      });
    });
    useGameStore.setState({ sendCommand: sendCommand as any });

    renderHook(() => useWalkController());

    act(() => {
      useGameStore.setState({
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS + 1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);
  });

  it('cancels auto-walk when a step causes damage', async () => {
    let currentPosition = { x: 1, y: 1 };
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const fromPos = currentPosition;
      currentPosition = movePosition(currentPosition, command.direction);
      useGameStore.setState({
        view: createDungeonView(currentPosition.x, currentPosition.y, 45),
      });
      emitPlayerMove(fromPos, currentPosition);
    });
    useGameStore.setState({ sendCommand: sendCommand as any });

    renderHook(() => useWalkController());

    act(() => {
      useGameStore.setState({
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS + 1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);
  });

  it('cancels auto-walk when a new threat appears after a step', async () => {
    let currentPosition = { x: 1, y: 1 };
    const sendCommand = vi.fn((command: { readonly type: string; readonly direction: string }) => {
      const fromPos = currentPosition;
      currentPosition = movePosition(currentPosition, command.direction);
      useGameStore.setState({
        view: createDungeonView(currentPosition.x, currentPosition.y, 50, [{
          id: 'enemy-new',
          type: 'enemy',
          x: currentPosition.x + 1,
          y: currentPosition.y,
        }]),
      });
      emitPlayerMove(fromPos, currentPosition);
    });
    useGameStore.setState({ sendCommand: sendCommand as any });

    renderHook(() => useWalkController());

    act(() => {
      useGameStore.setState({
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

    await act(async () => {
      await vi.advanceTimersByTimeAsync(BOUNDARY_MS + 1);
    });

    expect(sendCommand).toHaveBeenCalledTimes(1);
  });
});
