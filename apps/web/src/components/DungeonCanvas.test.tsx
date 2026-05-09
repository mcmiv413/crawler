import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';
import { CELL_SIZE } from '../config/ui-config.js';

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
  useMoveAnimationState: () => ({ animations: [] }),
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
  findPath: () => [],
}));

vi.mock('../store/game-store.js', () => ({
  useGameStore: vi.fn((selector) => {
    if (typeof selector === 'function') {
      return selector({
        startAutoWalk: vi.fn(),
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
      });
    }
    return { startAutoWalk: vi.fn() };
  }),
}));

import { renderMap } from '../sprites/canvas-renderer.js';
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
  entities: [],
};

describe('DungeonCanvas', () => {
  beforeEach(() => {
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
});
