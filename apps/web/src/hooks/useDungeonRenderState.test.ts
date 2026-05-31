import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { MapView } from '@dungeon/presenter';
import { getMoveTravelOffsetPx } from '../animations/move-style-profiles.js';

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
    animatedEvents: [] as unknown[],
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
        animatedEvents: gameStoreSpy.animatedEvents,
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

const CELL_SIZE = 24;

describe('useDungeonRenderState', () => {
  beforeEach(() => {
    bumpAnimationState.current = [];
    moveAnimationState.current = [];
    consumableAnimationState.current = [];
    fxAnimationState.current = [];
    gameStoreSpy.statuses = [];
    gameStoreSpy.animatedEvents = [];
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns the expected render-state fields', () => {
    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(Object.keys(result.current).sort()).toEqual([
      'bumpAnimations',
      'cameraOffset',
      'consumableAnimations',
      'displayMap',
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
      displayMap: BASE_MAP,
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
    const move = {
      id: 'move-0',
      entityId: 'player-1',
      fromPos: { x: 4, y: 5 },
      toPos: { x: 5, y: 5 },
      style: 'step' as const,
      progress: 0.5,
      durationMs: 120,
      startTime: 0,
      fromOffsetPx: { x: 0, y: 0 },
    };
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

  it('clamps viewport origin to the minimum visible cell coordinates', () => {
    const edgeMap: MapView = {
      ...BASE_MAP,
      playerPosition: { x: 10, y: 20 },
      cells: [
        { ...BASE_MAP.cells[0]!, x: 10, y: 20 },
        { ...BASE_MAP.cells[0]!, x: 11, y: 20 },
      ],
    };

    const { result } = renderHook(() => useDungeonRenderState(edgeMap, 20, 15));

    expect(result.current.vpLeft).toBe(10);
    expect(result.current.vpTop).toBe(20);
  });

  it('centers odd-width viewports with the pre-extraction canvas math', () => {
    const oddWidthMap: MapView = {
      ...BASE_MAP,
      playerPosition: { x: 20, y: 20 },
      cells: [
        BASE_MAP.cells[0]!,
        { ...BASE_MAP.cells[0]!, x: 40, y: 40 },
      ],
    };

    const { result } = renderHook(() => useDungeonRenderState(oddWidthMap, 15, 10));

    expect(result.current.vpLeft).toBe(13);
  });

  it('centers odd-height viewports with the pre-extraction canvas math', () => {
    const oddHeightMap: MapView = {
      ...BASE_MAP,
      playerPosition: { x: 20, y: 20 },
      cells: [
        BASE_MAP.cells[0]!,
        { ...BASE_MAP.cells[0]!, x: 40, y: 40 },
      ],
    };

    const { result } = renderHook(() => useDungeonRenderState(oddHeightMap, 10, 15));

    expect(result.current.vpTop).toBe(13);
  });

  it('keeps the player on the same screen tile as the legacy DungeonCanvas viewport math', () => {
    const parityMap: MapView = {
      ...BASE_MAP,
      playerPosition: { x: 20, y: 30 },
      cells: [
        BASE_MAP.cells[0]!,
        { ...BASE_MAP.cells[0]!, x: 40, y: 40 },
      ],
    };
    const vpTilesWidth = 15;
    const vpTilesHeight = 17;
    const legacyVpLeft = parityMap.playerPosition.x - Math.floor(vpTilesWidth / 2);
    const legacyVpTop = parityMap.playerPosition.y - Math.floor(vpTilesHeight / 2);

    const { result } = renderHook(() => useDungeonRenderState(parityMap, vpTilesWidth, vpTilesHeight));

    expect(parityMap.playerPosition.x - result.current.vpLeft).toBe(
      parityMap.playerPosition.x - legacyVpLeft,
    );
    expect(parityMap.playerPosition.y - result.current.vpTop).toBe(
      parityMap.playerPosition.y - legacyVpTop,
    );
  });

  it('returns zero camera offset when there is no active player move animation', () => {
    const { result } = renderHook(() => useDungeonRenderState(BASE_MAP, 20, 15));

    expect(result.current.cameraOffset).toEqual({ x: 0, y: 0 });
  });

  it('returns the inverse player move travel offset during an active player move', () => {
    const playerMove = {
      id: 'move-0',
      entityId: 'player-1',
      fromPos: { x: 4, y: 5 },
      toPos: { x: 5, y: 5 },
      style: 'step' as const,
      progress: 0.25,
      durationMs: 120,
      startTime: 0,
      fromOffsetPx: { x: 0, y: 0 },
    };

    moveAnimationState.current = [playerMove];

    const movingMap: MapView = {
      ...BASE_MAP,
      entities: [
        {
          id: 'player-1',
          type: 'player',
          x: 5,
          y: 5,
          ascii: '@',
          color: '#fff',
          name: 'Hero',
          templateId: 'player',
        },
      ],
    };

    const expectedOffset = getMoveTravelOffsetPx(playerMove, CELL_SIZE);
    const { result } = renderHook(() => useDungeonRenderState(movingMap, 20, 15));

    expect(result.current.cameraOffset).toEqual({
      x: -expectedOffset.x,
      y: -expectedOffset.y,
    });
  });

  it('uses carried walk-chain travel for the camera when a step inherits momentum', () => {
    const playerMove = {
      id: 'move-0',
      entityId: 'player-1',
      fromPos: { x: 4, y: 5 },
      toPos: { x: 5, y: 5 },
      style: 'step' as const,
      walkPhase: 'middle' as const,
      progress: 0.5,
      durationMs: 140,
      startTime: 0,
      fromOffsetPx: { x: -CELL_SIZE / 2, y: 0 },
    };

    moveAnimationState.current = [playerMove];

    const movingMap: MapView = {
      ...BASE_MAP,
      entities: [
        {
          id: 'player-1',
          type: 'player',
          x: 5,
          y: 5,
          ascii: '@',
          color: '#fff',
          name: 'Hero',
          templateId: 'player',
        },
      ],
    };

    const expectedOffset = getMoveTravelOffsetPx(playerMove, CELL_SIZE);
    const { result } = renderHook(() => useDungeonRenderState(movingMap, 20, 15));

    expect(result.current.cameraOffset).toEqual({
      x: -expectedOffset.x,
      y: -expectedOffset.y,
    });
  });

  it('retains killed ability targets at their action-time tile until the beat settles', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const previousMap: MapView = {
      ...BASE_MAP,
      entities: [
        {
          id: 'enemy-1',
          type: 'enemy',
          x: 6,
          y: 5,
          ascii: 'g',
          color: '#0f0',
          name: 'Goblin',
          templateId: 'goblin',
        },
      ],
    };
    const finalMap: MapView = {
      ...BASE_MAP,
      entities: [],
    };
    const { result, rerender } = renderHook(
      ({ map }) => useDungeonRenderState(map, 20, 15),
      { initialProps: { map: previousMap } },
    );

    gameStoreSpy.animatedEvents = [{
      type: 'ability',
      sequenceIndex: 0,
      delayMs: 0,
      beatId: 'beat-0',
      beatIndex: 0,
      beatRelativeDelayMs: 0,
      batchId: 'batch-0',
      data: {
        abilityId: 'power_strike',
        animationId: 'melee.power-strike',
        playerPos: { x: 5, y: 5 },
        targetPos: { x: 6, y: 5 },
        blastPositions: [],
        durationMs: 400,
        impactFrameMs: 200,
        suppressActorBump: false,
      },
    }];

    rerender({ map: finalMap });
    expect(result.current.displayMap.entities).toEqual(previousMap.entities);

    vi.setSystemTime(new Date('2024-01-01T00:00:00.450Z'));
    rerender({ map: finalMap });
    expect(result.current.displayMap.entities).toEqual([]);
  });

  it('keeps future movers at their previous tile until their move beat starts', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    const previousMap: MapView = {
      ...BASE_MAP,
      entities: [
        {
          id: 'enemy-1',
          type: 'enemy',
          x: 6,
          y: 5,
          ascii: 'g',
          color: '#0f0',
          name: 'Goblin',
          templateId: 'goblin',
        },
      ],
    };
    const finalMap: MapView = {
      ...BASE_MAP,
      entities: [
        {
          ...previousMap.entities[0]!,
          x: 7,
          y: 5,
        },
      ],
    };
    const { result, rerender } = renderHook(
      ({ map }) => useDungeonRenderState(map, 20, 15),
      { initialProps: { map: previousMap } },
    );

    gameStoreSpy.animatedEvents = [{
      type: 'move',
      sequenceIndex: 0,
      delayMs: 300,
      beatId: 'beat-1',
      beatIndex: 1,
      beatRelativeDelayMs: 0,
      batchId: 'batch-1',
      data: {
        entityId: 'enemy-1',
        fromPos: { x: 6, y: 5 },
        toPos: { x: 7, y: 5 },
        style: 'step',
        durationMs: 140,
      },
    }];

    rerender({ map: finalMap });
    expect(result.current.displayMap.entities[0]).toMatchObject({ x: 6, y: 5 });

    vi.setSystemTime(new Date('2024-01-01T00:00:00.350Z'));
    rerender({ map: finalMap });
    expect(result.current.displayMap.entities[0]).toMatchObject({ x: 7, y: 5 });
  });
});
