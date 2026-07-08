/**
 * Test layer: unit
 * Behavior: Retreat logic permits leaving from stairs or the entrance and records run-ending state when executing a retreat.
 * Proof: Assertions check canRetreat booleans, town phase, cleared run, incremented totalRuns, RUN_ENDED event emission, persistedFloorCache depth, and lastRetreatFloor bounds.
 * Validation: pnpm vitest run packages/game-core/src/systems/retreat.test.ts
 */
import { describe, it, expect } from 'vitest';
import { canRetreat, executeRetreat } from './retreat.js';
import { entityId } from '@dungeon/contracts';
import { SeededRNG } from '../utils/rng.js';

function createMockState(
  playerPos: { x: number; y: number },
  cellType: string,
  phase: string = 'dungeon',
  entrancePos: { x: number; y: number } = { x: 0, y: 0 },
) {
  const posKey = (p: { x: number; y: number }) => `${p.x},${p.y}`;
  const cells = new Map([
    [posKey(playerPos), { tile: { type: cellType, walkable: true } }],
    [posKey({ x: 5, y: 5 }), { tile: { type: 'floor', walkable: true } }],
  ]);

  return {
    gameId: entityId('game1'),
    phase,
    run: {
      runId: entityId('run1'),
      floor: {
        cells,
        entrance: entrancePos,
        exit: { x: 10, y: 10 },
        depth: 1,
        biomeId: 'stone_crypt',
        seed: 1,
      },
      enemies: new Map(),
      items: new Map(),
      turnCount: 0,
      isActive: true,
    },
    player: {
      id: entityId('player1'),
      name: 'Hero',
      level: 1,
      experience: 0,
      stats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 5 },
      baseStats: { maxHealth: 100, health: 100, attack: 10, defense: 5, accuracy: 80, evasion: 10, speed: 5 },
      position: playerPos,
      equipment: { weapon: null, armor: null, accessory: null },
      inventory: [],
      statuses: [],
      gold: 100,
      floor: 1,
      totalKills: 0,
      totalDeaths: 0,
      totalRuns: 5,
    },
    world: {
      town: { fear: 10, prosperity: 50, population: 100 },
      npcs: [],
      shop: {} as any,
      eventHistory: [],
      totalRuns: 5,
      deepestFloor: 1,
      nemeses: [],
      factions: [],
    },
    itemRegistry: { items: new Map() },
    seed: 1,
    turnNumber: 0,
    version: 1,
  } as any;
}

describe('retreat', () => {
  it('canRetreat returns true when on stairs_up tile', () => {
    const state = createMockState({ x: 5, y: 10 }, 'stairs_up');
    expect(canRetreat(state)).toBe(true);
  });

  it('canRetreat returns true when on entrance position', () => {
    const state = createMockState({ x: 0, y: 0 }, 'floor', 'dungeon', { x: 0, y: 0 });
    expect(canRetreat(state)).toBe(true);
  });

  it('canRetreat returns false when on a plain floor tile', () => {
    const state = createMockState({ x: 3, y: 4 }, 'floor');
    expect(canRetreat(state)).toBe(false);
  });

  it('executeRetreat sets phase to town, clears run and increments totalRuns', () => {
    const state = createMockState({ x: 5, y: 10 }, 'stairs_up');
    const rng = new SeededRNG(1);

    const result = executeRetreat(state, rng);

    expect(result.state.phase).toBe('town');
    expect(result.state.run).toBeNull();
    expect(result.state.player.totalRuns).toBe(state.player.totalRuns + 1);
    expect(Array.isArray(result.events)).toBe(true);
    expect(result.events.some((e: any) => e.type === 'RUN_ENDED')).toBe(true);
  });

  it('executeRetreat saves current floor to persistedFloorCache before clearing run', () => {
    const state = createMockState({ x: 5, y: 10 }, 'stairs_up');
    const currentFloorDepth = state.player.floor;
    const rng = new SeededRNG(1);

    const result = executeRetreat(state, rng);

    expect(result.state.persistedFloorCache).toBeDefined();
    expect(result.state.persistedFloorCache?.has(currentFloorDepth)).toBe(true);
    const cachedFloor = result.state.persistedFloorCache?.get(currentFloorDepth);
    expect(cachedFloor?.floor.depth).toBe(currentFloorDepth);
  });

  it('executeRetreat sets lastRetreatFloor to current player floor', () => {
    const state = createMockState({ x: 5, y: 10 }, 'stairs_up');
    const currentFloor = state.player.floor; // Should be 1
    const rng = new SeededRNG(1);

    const result = executeRetreat(state, rng);

    expect(result.state.lastRetreatFloor).toBe(currentFloor);
  });

  it('executeRetreat updates lastRetreatFloor when retreating from higher floors', () => {
    let state = createMockState({ x: 5, y: 10 }, 'stairs_up');

    // Simulate being on floor 3
    state = {
      ...state,
      player: { ...state.player, floor: 3 },
      run: {
        ...state.run!,
        floor: { ...state.run!.floor, depth: 3 },
      },
    };
    const rng = new SeededRNG(1);

    const result = executeRetreat(state, rng);

    expect(result.state.lastRetreatFloor).toBeGreaterThan(1);
    expect(result.state.lastRetreatFloor).toBeLessThanOrEqual(5);
  });
});
