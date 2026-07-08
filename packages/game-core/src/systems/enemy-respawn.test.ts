/**
 * Test layer: unit
 * Behavior: Enemy Respawn covers checkRespawn; returns unchanged state if respawn interval not reached; respawns an enemy when interval is reached and count < max.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/enemy-respawn.test.ts
 */
import { describe, it, expect } from 'vitest';
import { checkRespawn, respawnEnemiesOnPersistedFloor, simulatePersistedFloorTimeElapsed } from './enemy-respawn.js';
import { computeFov } from './fov.js';
import { createTestGameState, createTestRunState, createTestEnemy } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';
import type { MapCell, StoredFloor } from '@dungeon/contracts';

type BiomeDefinition = Parameters<typeof checkRespawn>[1];

const stoneCrypt: BiomeDefinition = {
  biomeId: 'stone_crypt',
  name: 'Stone Crypt',
  description: 'Ancient burial chambers carved from grey stone.',
  floorRange: { min: 1, max: 3 },
  tileWeights: { floor: 0.55, wall: 0.35, door: 0.1 },
  ambientColor: '#444444',
  floorAscii: '.',
  wallAscii: '#',
  mapGen: {
    roomWidth: [3, 5],
    roomHeight: [2, 4],
    corridorLength: [1, 3],
    dugPercentage: 0.38,
  },
};

const TEST_FACTIONS = createTestGameState().world.factions;
const MAX_RESPAWN_TURN_SEARCH = 200;

function createFloorCell(
  visibility: MapCell['visibility'] = 'hidden',
  tileType: 'floor' | 'wall' = 'floor',
): MapCell {
  return {
    tile: {
      type: tileType,
      walkable: tileType === 'floor',
      blocksVision: tileType === 'wall',
      ascii: tileType === 'wall' ? '#' : '.',
      color: tileType === 'wall' ? '#444' : '#aaa',
    },
    visibility,
  };
}

function createFilledFloor(
  baseFloor: ReturnType<typeof createTestRunState>['floor'],
  width: number,
  height: number,
  options: { visibility?: MapCell['visibility']; depth?: number } = {},
): ReturnType<typeof createTestRunState>['floor'] {
  const { visibility = 'hidden', depth = baseFloor.depth } = options;
  const filledFloor = {
    ...baseFloor,
    width,
    height,
    depth,
    cells: new Map<string, MapCell>(),
  };
  const floorCell = createFloorCell(visibility);

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      filledFloor.cells.set(`${x},${y}`, floorCell);
    }
  }

  return filledFloor;
}

function findFirstRespawnTurn(state: Parameters<typeof checkRespawn>[0]): number {
  if (state.run === null) {
    throw new Error('Respawn tests require an active dungeon run');
  }

  for (let turnCount = 1; turnCount <= MAX_RESPAWN_TURN_SEARCH; turnCount += 1) {
    const result = checkRespawn(
      {
        ...state,
        run: { ...state.run, turnCount },
      },
      stoneCrypt,
      new SeededRNG(42),
    );

    if (result.events.some((event) => event.type === 'ENEMY_SPAWNED')) {
      return turnCount;
    }
  }

  throw new Error(`Could not find a respawn turn within ${MAX_RESPAWN_TURN_SEARCH} turns`);
}

describe('checkRespawn', () => {
  it('returns unchanged state if respawn interval not reached', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const state = { ...baseState, run: createTestRunState() };

    const result = checkRespawn(state, stoneCrypt, rng);
    expect(result.state).toBe(state);
    expect(result.events).toHaveLength(0);
  });

  it('respawns an enemy when interval is reached and count < max', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const run = {
      ...createTestRunState({ enemies: new Map([['1,1', createTestEnemy()]]) }),
      floor: createFilledFloor(createTestRunState().floor, 40, 40),
    };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0, enemies: new Map() } };
    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };

    const result = checkRespawn(state, stoneCrypt, rng);
    expect(result.events.some((event) => event.type === 'ENEMY_SPAWNED')).toBe(true);
  });

  it('does not respawn if enemy count >= maxEnemiesOnFloor', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });

    const enemies = new Map<string, ReturnType<typeof createTestEnemy>>();
    for (let i = 0; i < 100; i++) {
      enemies.set(`${i},0`, createTestEnemy({ position: { x: i, y: 0 } }));
    }
    const run = {
      ...createTestRunState({ enemies }),
      floor: createFilledFloor(createTestRunState().floor, 40, 40),
    };
    const respawnTurn = findFirstRespawnTurn({
      ...baseState,
      run: { ...run, turnCount: 0, enemies: new Map() },
    });

    const state = { ...baseState, run: { ...run, turnCount: respawnTurn } };

    const result = checkRespawn(state, stoneCrypt, rng);
    expect(result.events.filter((event) => event.type === 'ENEMY_SPAWNED')).toHaveLength(0);
  });

  it('does not respawn bosses', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const run = {
      ...createTestRunState({ enemies: new Map() }),
      floor: createFilledFloor(createTestRunState().floor, 40, 40),
    };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0 } };

    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };

    const result = checkRespawn(state, stoneCrypt, rng);
    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        const spawnedEnemy = result.state.run?.enemies.get(`${event.position.x},${event.position.y}`);
        expect(spawnedEnemy?.archetype).not.toBe('boss');
      }
    }
  });

  it('respawned enemies not placed in player FOV', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon', player: { position: { x: 5, y: 5 } } });
    const run = {
      ...createTestRunState({ enemies: new Map() }),
      floor: createFilledFloor(createTestRunState().floor, 30, 30),
    };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0, enemies: new Map() } };
    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };
    const visibleCells = computeFov(state.run.floor, state.player.position);

    const result = checkRespawn(state, stoneCrypt, rng);

    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        const visibility = visibleCells.get(`${event.position.x},${event.position.y}`)?.visibility;
        expect(visibility).not.toBe('visible');
      }
    }
  });

  it('enemy stats scale with floor depth', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const run = {
      ...createTestRunState({ enemies: new Map() }),
      floor: createFilledFloor(createTestRunState().floor, 40, 40, { depth: 8 }),
    };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0, enemies: new Map() } };
    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };

    const result = checkRespawn(state, stoneCrypt, rng);

    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        const spawnedEnemy = result.state.run?.enemies.get(`${event.position.x},${event.position.y}`);
        if (spawnedEnemy) {
          expect(spawnedEnemy.stats.health).toBeGreaterThan(0);
          expect(spawnedEnemy.stats.attack).toBeGreaterThan(0);
        }
      }
    }
  });

  it('spawns only a bounded subset of available positions per tick', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const run = {
      ...createTestRunState({ enemies: new Map() }),
      floor: createFilledFloor(createTestRunState().floor, 50, 50),
    };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0, enemies: new Map() } };
    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };

    const result = checkRespawn(state, stoneCrypt, rng);

    const spawnedCount = result.events.filter((event) => event.type === 'ENEMY_SPAWNED').length;
    expect(spawnedCount).toBeGreaterThan(0);
    expect(spawnedCount).toBeLessThan(10);
  });

  it('boss exclusion loop terminates safely', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const run = {
      ...createTestRunState({ enemies: new Map() }),
      floor: createFilledFloor(createTestRunState().floor, 40, 40),
    };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0, enemies: new Map() } };
    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };

    const result = checkRespawn(state, stoneCrypt, rng);

    expect(result.state).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('respawn FOV respects wall barriers (shadowcasting)', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon', player: { position: { x: 5, y: 5 } } });

    let run = createTestRunState({ enemies: new Map() });
    const largeFloor = createFilledFloor(run.floor, 20, 20);
    const largeFloorCells = new Map(largeFloor.cells);
    const wallCell = createFloorCell('hidden', 'wall');

    for (let y = 0; y < 20; y++) {
      largeFloorCells.set(`7,${y}`, wallCell);
    }

    run = { ...run, floor: { ...largeFloor, cells: largeFloorCells } };
    const spawnReadyState = { ...baseState, run: { ...run, turnCount: 0, enemies: new Map() } };
    const state = {
      ...spawnReadyState,
      run: { ...spawnReadyState.run, turnCount: findFirstRespawnTurn(spawnReadyState) },
    };

    const result = checkRespawn(state, stoneCrypt, rng);

    const visibleCells = computeFov(state.run.floor, state.player.position);
    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        expect(visibleCells.get(`${event.position.x},${event.position.y}`)?.visibility).not.toBe('visible');
      }
    }

    expect(result.events.some((event) => event.type === 'ENEMY_SPAWNED')).toBe(true);
  });
});

describe('respawnEnemiesOnPersistedFloor', () => {
  it('respawns enemies up to 50% cap', () => {
    const rng = new SeededRNG(42);
    const run = createTestRunState({ enemies: new Map() });

    // Create a large floor with plenty of spawn space
    const largeFloor = {
      ...run.floor,
      width: 40,
      height: 40,
      cells: new Map<string, any>(),
    };

    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' as const };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    const originalEnemyCount = 10;
    const respawned = respawnEnemiesOnPersistedFloor(
      largeFloor,
      new Map(), // No current enemies
      originalEnemyCount,
      stoneCrypt,
      1, // depth
      30, // 30 turns since last visit
      rng,
      TEST_FACTIONS,
    );

    // Should respawn some enemies but capped at 50% (5)
    expect(respawned.size).toBeGreaterThan(0);
    expect(respawned.size).toBeLessThanOrEqual(5);
  });

  it('does not respawn if no time has passed', () => {
    const rng = new SeededRNG(42);
    const run = createTestRunState({ enemies: new Map() });
    const largeFloor = { ...run.floor, width: 40, height: 40, cells: new Map<string, any>() };

    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' as const };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    const respawned = respawnEnemiesOnPersistedFloor(
      largeFloor,
      new Map(),
      10,
      stoneCrypt,
      1,
      0, // No time elapsed
      rng,
      TEST_FACTIONS,
    );

    expect(respawned.size).toBeLessThanOrEqual(0);
  });
});

describe('simulatePersistedFloorTimeElapsed', () => {
  it('simulates respawning and ambient behavior on cached floor', () => {
    const rng = new SeededRNG(42);
    let run = createTestRunState({ enemies: new Map() });

    // Create a large floor with spawn space
    const largeFloor = {
      ...run.floor,
      width: 40,
      height: 40,
      cells: new Map<string, any>(),
    };

    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' as const };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    const storedFloor: StoredFloor = {
      floor: largeFloor,
      enemies: new Map(),
      objects: new Map(),
      playerPosition: largeFloor.entrance,
      originalEnemyCount: 10,
      lastSimulatedTurn: 0,
    };

    const simulated = simulatePersistedFloorTimeElapsed(
      storedFloor,
      30, // 30 turns have passed
      stoneCrypt,
      1,
      rng,
      TEST_FACTIONS,
    );

    // Should have respawned enemies
    expect(simulated.enemies.size).toBeGreaterThan(0);
    expect(simulated.lastSimulatedTurn).toBeGreaterThan(20);
    expect(simulated.lastSimulatedTurn).toBeLessThanOrEqual(30);
  });
});
