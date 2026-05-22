import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';

const { startAutoWalkSpy, moveAnimationState } = vi.hoisted(() => ({
  startAutoWalkSpy: vi.fn(),
  moveAnimationState: {
    current: [] as Array<{
      id: string;
      entityId: string;
      fromPos: { x: number; y: number };
      toPos: { x: number; y: number };
      style: 'step' | 'slide' | 'dart' | 'drift' | 'stomp' | 'lurch';
      progress: number;
      fromOffsetPx?: { x: number; y: number };
    }>,
  },
}));

vi.mock('../sprites/sprite-registry.js', () => ({
  spriteRegistry: {
    isReady: () => true,
    onReady: vi.fn(),
    load: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../sprites/canvas-renderer.js', () => ({
  renderMap: vi.fn(),
}));

vi.mock('../hooks/useBumpAnimationState.js', () => ({
  useBumpAnimationState: () => ({ animations: [] }),
}));

vi.mock('../hooks/useMoveAnimationState.js', () => ({
  useMoveAnimationState: () => ({ animations: moveAnimationState.current }),
}));

vi.mock('../hooks/useConsumableAnimationState.js', () => ({
  useConsumableAnimationState: () => ({ animations: [] }),
}));

vi.mock('../hooks/useFxAnimationState.js', () => ({
  useFxAnimationState: () => ({ animations: [] }),
}));

vi.mock('../animations/generated/index.js', () => ({
  initializeAnimationModules: vi.fn(),
}));

vi.mock('../utils/pathfinding.js', () => ({
  findPath: vi.fn(() => []),
}));

vi.mock('../store/game-store.js', () => ({
  useGameStore: Object.assign(
    vi.fn((selector) => {
      const state = {
        startAutoWalk: startAutoWalkSpy,
        view: {
          animatedEvents: [],
          player: {
            statuses: [
              {
                id: 'fixture_status',
                name: 'Fixture Status',
                turnsRemaining: 2,
                beneficial: true,
                presentation: { entityScale: 1.25 },
              },
            ],
          },
        },
      };

      if (typeof selector === 'function') {
        return selector(state);
      }

      return state;
    }),
    {
      getState: () => ({ startAutoWalk: startAutoWalkSpy }),
    },
  ),
}));

import { renderMap } from '../sprites/canvas-renderer.js';
import { findPath } from '../utils/pathfinding.js';
import { DungeonCanvas } from './DungeonCanvas.js';

const map: MapView = {
  width: 10,
  height: 10,
  biomeId: 'dungeon',
  dangerLevel: 'moderate',
  playerPosition: { x: 1, y: 1 },
  cells: [
    {
      x: 0,
      y: 0,
      ascii: '.',
      color: '#aaa',
      bgColor: '#000',
      visibility: 'visible',
      walkable: true,
      tileType: 'floor',
    },
  ],
  entities: [
    {
      id: 'player-1',
      type: 'player' as const,
      x: 1,
      y: 1,
      color: '#fff',
      ascii: '@',
      name: 'Player',
      templateId: 'player',
    },
  ],
};

describe('DungeonCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    startAutoWalkSpy.mockReset();
    moveAnimationState.current = [];
    vi.mocked(findPath).mockReturnValue([]);

    Object.defineProperty(window, 'devicePixelRatio', {
      configurable: true,
      value: 1,
    });

    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      writable: true,
      value: vi.fn(
        () =>
          ({
            scale: vi.fn(),
            imageSmoothingEnabled: false,
          }) as unknown as CanvasRenderingContext2D,
      ),
    });
  });

  it('sizes the canvas from the shared CELL_SIZE constant', () => {
    const { container } = render(
      <DungeonCanvas map={map} vpTilesWidth={5} vpTilesHeight={4} />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();
    expect(canvas?.style.width).toBe(`${5 * CELL_SIZE}px`);
    expect(canvas?.style.height).toBe(`${4 * CELL_SIZE}px`);
    expect(canvas?.width).toBe(5 * CELL_SIZE);
    expect(canvas?.height).toBe(4 * CELL_SIZE);
    expect(renderMap).toHaveBeenCalled();
    expect(vi.mocked(renderMap).mock.calls[0]?.[10]).toEqual({
      statusPresentations: [{ entityScale: 1.25 }],
    });
  });

  it('starts auto-walk when clicking a reachable walkable tile', () => {
    const path = [
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ];
    vi.mocked(findPath).mockReturnValue(path);

    const clickableMap: MapView = {
      ...map,
      cells: [
        ...map.cells,
        {
          x: 2,
          y: 1,
          ascii: '.',
          color: '#aaa',
          bgColor: '#000',
          visibility: 'visible',
          walkable: true,
          tileType: 'floor',
        },
      ],
    };

    const { container } = render(
      <DungeonCanvas map={clickableMap} vpTilesWidth={5} vpTilesHeight={4} />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    Object.defineProperty(canvas!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 5 * CELL_SIZE,
        height: 4 * CELL_SIZE,
        right: 5 * CELL_SIZE,
        bottom: 4 * CELL_SIZE,
        x: 0,
        y: 0,
        toJSON: () => '',
      }),
    });

    fireEvent.click(canvas!, {
      clientX: (2 * CELL_SIZE) + 1,
      clientY: CELL_SIZE + 1,
    });

    expect(findPath).toHaveBeenCalledWith(clickableMap, clickableMap.playerPosition, { x: 2, y: 1 });
    expect(startAutoWalkSpy).toHaveBeenCalledWith(path);
  });

  it('maps clicks through the active player camera pan', () => {
    const path = [
      { x: 4, y: 1 },
      { x: 3, y: 1 },
    ];
    vi.mocked(findPath).mockReturnValue(path);
    moveAnimationState.current = [{
      id: 'move-0',
      entityId: 'player-1',
      fromPos: { x: 3, y: 1 },
      toPos: { x: 4, y: 1 },
      style: 'step',
      progress: 0,
    }];

    const panningMap: MapView = {
      ...map,
      playerPosition: { x: 4, y: 1 },
      cells: [
        {
          x: 3,
          y: 1,
          ascii: '.',
          color: '#aaa',
          bgColor: '#000',
          visibility: 'visible',
          walkable: true,
          tileType: 'floor',
        },
        {
          x: 4,
          y: 1,
          ascii: '.',
          color: '#aaa',
          bgColor: '#000',
          visibility: 'visible',
          walkable: true,
          tileType: 'floor',
        },
      ],
      entities: [
        {
          id: 'player-1',
          type: 'player',
          x: 4,
          y: 1,
          color: '#fff',
          ascii: '@',
          name: 'Player',
          templateId: 'player',
        },
      ],
    };

    const { container } = render(
      <DungeonCanvas map={panningMap} vpTilesWidth={5} vpTilesHeight={4} />,
    );

    const canvas = container.querySelector('canvas');
    expect(canvas).not.toBeNull();

    Object.defineProperty(canvas!, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        left: 0,
        top: 0,
        width: 5 * CELL_SIZE,
        height: 4 * CELL_SIZE,
        right: 5 * CELL_SIZE,
        bottom: 4 * CELL_SIZE,
        x: 0,
        y: 0,
        toJSON: () => '',
      }),
    });

    fireEvent.click(canvas!, {
      clientX: CELL_SIZE + 1,
      clientY: 1,
    });

    expect(findPath).toHaveBeenCalledWith(panningMap, panningMap.playerPosition, { x: 3, y: 1 });
    expect(startAutoWalkSpy).toHaveBeenCalledWith(path);
  });
});
