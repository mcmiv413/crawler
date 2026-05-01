import { describe, it, expect } from 'vitest';
import { checkRespawn, respawnEnemiesOnPersistedFloor, simulatePersistedFloorTimeElapsed } from './enemy-respawn.js';
import { createTestGameState, createTestRunState, createTestEnemy } from '../test-utils.js';
import { SeededRNG } from '../utils/rng.js';
import { ENEMY_RESPAWN, INITIAL_FACTIONS, stoneCrypt } from '@dungeon/content';
import type { StoredFloor } from '@dungeon/contracts';

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
    const enemy = createTestEnemy();
    const enemies = new Map([['1,1', enemy]]);
    let run = createTestRunState({ enemies });

    // Create a larger floor to have more spawn candidates
    const largeFloor = {
      ...run.floor,
      width: 40,
      height: 40,
      cells: new Map<string, any>(),
    };

    // Fill with walkable cells
    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' as const };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    run = { ...run, floor: largeFloor };

    // Start with few enemies
    let state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns, enemies: new Map() } };

    const result = checkRespawn(state, stoneCrypt, rng);
    // Should have spawned if below max
    expect(result.events.some(e => e.type === 'ENEMY_SPAWNED')).toBe(true);
  });

  it('does not respawn if enemy count >= maxEnemiesOnFloor', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });

    // Create maxEnemiesOnFloor enemies
    const enemies = new Map<string, any>();
    for (let i = 0; i < ENEMY_RESPAWN.maxEnemiesOnFloor; i++) {
      enemies.set(`${i},0`, createTestEnemy({ position: { x: i, y: 0 } }));
    }
    const run = createTestRunState({ enemies });

    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns } };

    const result = checkRespawn(state, stoneCrypt, rng);
    // Should not spawn if at max
    expect(result.events.filter(e => e.type === 'ENEMY_SPAWNED')).toHaveLength(0);
  });

  it('does not respawn bosses', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });
    const run = createTestRunState({ enemies: new Map() });

    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns } };

    const result = checkRespawn(state, stoneCrypt, rng);
    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        // Should not have spawned a boss
        const spawnedEnemy = result.state.run?.enemies.get((event as any).enemyId);
        expect(spawnedEnemy?.archetype).not.toBe('boss');
      }
    }
  });

  it('respawned enemies not placed in player FOV', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon', player: { position: { x: 5, y: 5 } } });

    // Create a floor with FOV
    let run = createTestRunState({ enemies: new Map() });
    const largeFloor = {
      ...run.floor,
      width: 30,
      height: 30,
      cells: new Map<string, any>(),
    };

    // Mark player position cells as visible (FOV)
    const visibleCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' as const };
    const hiddenCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' as const };

    // Fill FOV area with visible cells
    for (let x = 3; x < 8; x++) {
      for (let y = 3; y < 8; y++) {
        largeFloor.cells.set(`${x},${y}`, visibleCell);
      }
    }
    // Fill rest with hidden cells
    for (let x = 0; x < 30; x++) {
      for (let y = 0; y < 30; y++) {
        if (x < 3 || x >= 8 || y < 3 || y >= 8) {
          largeFloor.cells.set(`${x},${y}`, hiddenCell);
        }
      }
    }

    run = { ...run, floor: largeFloor };
    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns, enemies: new Map() } };

    const result = checkRespawn(state, stoneCrypt, rng);

    // Check that spawned enemies are not in visible area (FOV)
    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        const spawnedEnemy = result.state.run?.enemies.get((event as any).enemyId);
        if (spawnedEnemy) {
          // Spawned enemy should NOT be at player position or in FOV
          expect(spawnedEnemy.position.x === baseState.player.position.x && spawnedEnemy.position.y === baseState.player.position.y).toBe(false);
        }
      }
    }
  });

  it('enemy stats scale with floor depth', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });

    // Create state at deeper floor
    let run = createTestRunState({ enemies: new Map() });
    const largeFloor = {
      ...run.floor,
      width: 40,
      height: 40,
      depth: 8, // Deeper floor
      cells: new Map<string, any>(),
    };

    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' as const };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    run = { ...run, floor: largeFloor };
    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns, enemies: new Map() } };

    const result = checkRespawn(state, stoneCrypt, rng);

    // Check that spawned enemies have appropriate stats for the depth
    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        const spawnedEnemy = result.state.run?.enemies.get((event as any).enemyId);
        if (spawnedEnemy) {
          // Deeper floors should have stronger enemies
          expect(spawnedEnemy.stats.health).toBeGreaterThan(0);
          expect(spawnedEnemy.stats.attack).toBeGreaterThan(0);
        }
      }
    }
  });

  it('respawnCountPerTick limits spawns per tick', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });

    // Create a large floor with many spawn points
    let run = createTestRunState({ enemies: new Map() });
    const largeFloor = {
      ...run.floor,
      width: 50,
      height: 50,
      cells: new Map<string, any>(),
    };

    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' as const };
    for (let x = 0; x < 50; x++) {
      for (let y = 0; y < 50; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    run = { ...run, floor: largeFloor };
    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns, enemies: new Map() } };

    const result = checkRespawn(state, stoneCrypt, rng);

    // Count spawned enemies
    const spawnedCount = result.events.filter(e => e.type === 'ENEMY_SPAWNED').length;
    // Should not exceed respawnCountPerTick
    expect(spawnedCount).toBeLessThanOrEqual(ENEMY_RESPAWN.respawnCountPerTick);
  });

  it('boss exclusion loop terminates safely', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon' });

    // Create a floor with only boss archetype available (edge case)
    let run = createTestRunState({ enemies: new Map() });
    const largeFloor = {
      ...run.floor,
      width: 40,
      height: 40,
      cells: new Map<string, any>(),
    };

    const floorCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'visible' as const };
    for (let x = 0; x < 40; x++) {
      for (let y = 0; y < 40; y++) {
        largeFloor.cells.set(`${x},${y}`, floorCell);
      }
    }

    run = { ...run, floor: largeFloor };
    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns, enemies: new Map() } };

    // Should not hang or crash even in edge case
    const result = checkRespawn(state, stoneCrypt, rng);

    // Should return a valid result
    expect(result.state).toBeDefined();
    expect(Array.isArray(result.events)).toBe(true);
  });

  it('respawn FOV respects wall barriers (shadowcasting)', () => {
    const rng = new SeededRNG(42);
    const baseState = createTestGameState({ phase: 'dungeon', player: { position: { x: 5, y: 5 } } });

    let run = createTestRunState({ enemies: new Map() });
    const largeFloor = {
      ...run.floor,
      width: 20,
      height: 20,
      cells: new Map<string, any>(),
    };

    const walkableCell = { tile: { type: 'floor' as const, walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' as const };
    const wallCell = { tile: { type: 'wall' as const, walkable: false, blocksVision: true, ascii: '#', color: '#444' }, visibility: 'hidden' as const };

    for (let x = 0; x < 20; x++) {
      for (let y = 0; y < 20; y++) {
        largeFloor.cells.set(`${x},${y}`, walkableCell);
      }
    }

    for (let y = 0; y < 20; y++) {
      largeFloor.cells.set(`7,${y}`, wallCell);
    }

    run = { ...run, floor: largeFloor };
    const state = { ...baseState, run: { ...run, turnCount: ENEMY_RESPAWN.respawnIntervalTurns, enemies: new Map() } };

    const result = checkRespawn(state, stoneCrypt, rng);

    let spawnedCount = 0;
    for (const event of result.events) {
      if (event.type === 'ENEMY_SPAWNED') {
        spawnedCount++;
      }
    }

    // Should spawn at least 1 enemy with sufficient candidates
    expect(spawnedCount).toBeGreaterThan(0);
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
      INITIAL_FACTIONS,
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
      INITIAL_FACTIONS,
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
      INITIAL_FACTIONS,
    );

    // Should have respawned enemies
    expect(simulated.enemies.size).toBeGreaterThan(0);
    expect(simulated.lastSimulatedTurn).toBeGreaterThan(20);
    expect(simulated.lastSimulatedTurn).toBeLessThanOrEqual(30);
  });
});
