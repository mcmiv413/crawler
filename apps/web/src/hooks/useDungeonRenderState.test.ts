import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';

const {
  bumpAnimationState,
  moveAnimationState,
  consumableAnimationState,
  fxAnimationState,
  gameStoreSpy,
} = vi.hoisted(() => ({
  bumpAnimationState: {
    current: [] as unknown[],
  },
  moveAnimationState: {
    current: [] as unknown[],
  },
  consumableAnimationState: {
    current: [] as unknown[],
  },
  fxAnimationState: {
    current: [] as unknown[],
  },
  gameStoreSpy: {
    statuses: [] as Array<{
      id: string;
      name: string;
      turnsRemaining: number;
      beneficial: boolean;
      presentation?: { entityScale?: number };
    }>,
  },
}));

vi.mock('./useBumpAnimationState.js', () => ({
  useBumpAnimationState: () => ({ animations: bumpAnimationState.current }),
}));

vi.mock('./useMoveAnimationState.js', () => ({
  useMoveAnimationState: () => ({ animations: moveAnimationState.current }),
}));

vi.mock('./useConsumableAnimationState.js', () => ({
  useConsumableAnimationState: () => ({ animations: consumableAnimationState.current }),
}));

vi.mock('./useFxAnimationState.js', () => ({
  useFxAnimationState: () => ({ animations: fxAnimationState.current }),
}));

vi.mock('../store/game-store.js', () => ({
  useGameStore: vi.fn((selector: (state: unknown) => unknown) => {
    const state = {
      view: {
        player: { statuses: gameStoreSpy.statuses },
      },
    };
    return typeof selector === 'function' ? selector(state) : state;
  }),
}));

import { useDungeonRenderState } from './useDungeonRenderState.js';

const BASE_MAP: MapView = {
  width: 10,
  height: 10,
  biomeId: 'test_biome',
  dangerLevel: 'safe',
  playerPosition: { x: 5, y: 5 },
  cells: [
    {
      x: 0,
      y: 0,
      visibility: 'visible',
      walkable: true,
      tileType: 'floor',
      ascii: '.',
      color: '#fff',
      bgColor: '#000',
    },
  ],
  entities: [],
};

describe('useDungeonRenderState', () => {
  beforeEach(() => {
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [];
    fxAnimationState.current = [];
    gameStoreSpy.statuses = [];
  });

  it('returns the expected render-state fields', () => {
    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(Object.keys(result.current).sort()).toEqual([
      'bumpAnimations',
      'cameraOffset',
      'consumableAnimations',
      'fxAnimations',
      'moveAnimations',
      'statusPresentations',
      'vpLeft',
      'vpTop',
    ]);
  });

  it('accepts map, vpTilesWidth, and vpTilesHeight as inputs', () => {
    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(result.current).toMatchObject({
      vpLeft: expect.any(Number),
      vpTop: expect.any(Number),
      cameraOffset: {
        x: expect.any(Number),
        y: expect.any(Number),
      },
    });
  });

  it('reflects active animation state from dependency hooks', () => {
    const bump = { id: 'bump-0' };
    const move = { id: 'move-0' };
    const consumable = { id: 'consumable-0' };
    const fx = { id: 'fx-0' };
    bumpAnimationState.current = [bump];
    moveAnimationState.current = [move];
    consumableAnimationState.current = [consumable];
    fxAnimationState.current = [fx];

    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(result.current.bumpAnimations).toEqual([bump]);
    expect(result.current.moveAnimations).toEqual([move]);
    expect(result.current.consumableAnimations).toEqual([consumable]);
    expect(result.current.fxAnimations).toEqual([fx]);
  });

  it('builds status presentations from player statuses in the store', () => {
    gameStoreSpy.statuses = [
      {
        id: 'strength_up',
        name: 'Strength Up',
        turnsRemaining: 3,
        beneficial: true,
        presentation: { entityScale: 1.25 },
      },
      {
        id: 'poisoned',
        name: 'Poisoned',
        turnsRemaining: 2,
        beneficial: false,
      },
    ];

    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(result.current.statusPresentations).toEqual([{ entityScale: 1.25 }]);
  });

  it('returns empty animation arrays when no animations are active', () => {
    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(result.current.bumpAnimations).toHaveLength(0);
    expect(result.current.moveAnimations).toHaveLength(0);
    expect(result.current.consumableAnimations).toHaveLength(0);
    expect(result.current.fxAnimations).toHaveLength(0);
  });
});
