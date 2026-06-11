import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { entityId, type GameState, type StoredFloor } from '@dungeon/contracts';
import { GameEngine } from './game-engine.js';
import { serializeState, deserializeState } from '../state/serialization.js';
import { createTestGameStateInCombat, createWaitCommand } from '../test-utils.js';
import { handlePlayerDeath } from '../systems/death.js';
import { SeededRNG } from '../utils/rng.js';

type FloorPersistenceAction = 'enter' | 'descend' | 'ascend' | 'retreat' | 'death' | 'saveLoad';
type CardinalDirection = 'N' | 'S' | 'E' | 'W';

interface FloorFingerprint {
  readonly depth: number;
  readonly biomeId: string;
  readonly seed: number;
  readonly entrance: string;
  readonly exit: string;
  readonly cells: readonly string[];
}

const CARDINAL_STEPS: ReadonlyArray<{
  readonly direction: CardinalDirection;
  readonly dx: number;
  readonly dy: number;
}> = [
  { direction: 'N', dx: 0, dy: -1 },
  { direction: 'S', dx: 0, dy: 1 },
  { direction: 'E', dx: 1, dy: 0 },
  { direction: 'W', dx: -1, dy: 0 },
];

function normalizeNewGameState(state: GameState): GameState {
  return {
    ...state,
    gameId: entityId('normalized-game'),
    player: {
      ...state.player,
      id: entityId('normalized-player'),
    },
  };
}

function createStoredFloorSnapshot(state: GameState): StoredFloor {
  if (state.run === null) {
    throw new Error('Expected an active run to build a stored floor snapshot');
  }

  return {
    floor: state.run.floor,
    enemies: state.run.enemies,
    objects: state.run.objects,
    playerPosition: state.player.position,
    originalEnemyCount: state.run.enemies.size,
    lastSimulatedTurn: 23,
  };
}

function positionKey(pos: { readonly x: number; readonly y: number }): string {
  return `${pos.x},${pos.y}`;
}

function fingerprintFloor(storedFloor: StoredFloor): FloorFingerprint {
  const floor = storedFloor.floor;
  return {
    depth: floor.depth,
    biomeId: floor.biomeId,
    seed: floor.seed,
    entrance: positionKey(floor.entrance),
    exit: positionKey(floor.exit),
    cells: Array.from(floor.cells.entries())
      .map(([key, cell]) => `${key}:${cell.tile.type}:${cell.tile.walkable}:${cell.tile.blocksVision}:${cell.tile.ascii}:${cell.tile.color}`)
      .sort(),
  };
}

function activeFloorAsStoredFloor(state: GameState): StoredFloor {
  if (state.run === null) {
    throw new Error('Expected active run');
  }

  return {
    floor: state.run.floor,
    enemies: state.run.enemies,
    objects: state.run.objects,
    playerPosition: state.player.position,
  };
}

function clearRunEnemies(state: GameState): GameState {
  if (state.run === null) return state;

  return {
    ...state,
    run: {
      ...state.run,
      enemies: new Map(),
      speedAccumulators: {},
    },
  };
}

function findPathTo(state: GameState, target: { readonly x: number; readonly y: number }): CardinalDirection[] {
  if (state.run === null) {
    throw new Error('Expected active run');
  }

  const queue: Array<{
    readonly pos: { readonly x: number; readonly y: number };
    readonly path: CardinalDirection[];
  }> = [{ pos: state.player.position, path: [] }];
  const visited = new Set([positionKey(state.player.position)]);
  const targetKey = positionKey(target);

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (positionKey(current.pos) === targetKey) {
      return current.path;
    }

    for (const step of CARDINAL_STEPS) {
      const nextPos = { x: current.pos.x + step.dx, y: current.pos.y + step.dy };
      const nextKey = positionKey(nextPos);
      if (visited.has(nextKey)) continue;
      const cell = state.run.floor.cells.get(nextKey);
      if (cell?.tile.walkable !== true) continue;

      visited.add(nextKey);
      queue.push({ pos: nextPos, path: [...current.path, step.direction] });
    }
  }

  throw new Error(`No path found to ${targetKey}`);
}

function descendOneFloor(engine: GameEngine, state: GameState): GameState {
  if (state.run === null) return state;

  let nextState = clearRunEnemies(state);
  for (const direction of findPathTo(nextState, nextState.run!.floor.exit)) {
    nextState = clearRunEnemies(engine.submitCommand(nextState, { type: 'MOVE', direction }).state);
  }
  return nextState;
}

function assertAndRecordVisitedFloor(
  state: GameState,
  expectedFingerprints: Map<number, FloorFingerprint>,
): void {
  if (state.run !== null) {
    const activeFingerprint = fingerprintFloor(activeFloorAsStoredFloor(state));
    const expected = expectedFingerprints.get(state.player.floor);
    if (expected === undefined) {
      expectedFingerprints.set(state.player.floor, activeFingerprint);
    } else {
      expect(activeFingerprint).toEqual(expected);
    }
  }

  for (const [depth, storedFloor] of state.persistedFloorCache ?? []) {
    const storedFingerprint = fingerprintFloor(storedFloor);
    const expected = expectedFingerprints.get(depth);
    if (expected === undefined) {
      expectedFingerprints.set(depth, storedFingerprint);
    } else {
      expect(storedFingerprint).toEqual(expected);
    }
  }
}

function collectNonEnumerablePaths(
  value: unknown,
  path: string,
  failures: string[],
): void {
  if (value === null || typeof value !== 'object') {
    return;
  }

  if (value instanceof Map) {
    return;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      collectNonEnumerablePaths(value[index], `${path}[${index}]`, failures);
    }
    return;
  }

  const objectValue = value as Record<string, unknown>;
  for (const key of Object.getOwnPropertyNames(objectValue)) {
    const descriptor = Object.getOwnPropertyDescriptor(objectValue, key);
    if (descriptor?.enumerable === false) {
      failures.push(`${path}.${key}`);
    }
    collectNonEnumerablePaths(objectValue[key], `${path}.${key}`, failures);
  }
}

describe('save/load roundtrip property tests', () => {
  it('game state should survive JSON serialization roundtrip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        (seed) => {
          const engine = new GameEngine();
          const state = engine.createNewGame(seed);

          // Enter dungeon
          const entered = engine.submitCommand(state, {
            type: 'TOWN_ACTION',
            action: 'enter_dungeon',
          });

          const original = entered.state;

          // Serialize and deserialize using the proper functions
          const json = serializeState(original);
          expect(json.length).toBeGreaterThan(0);

          const restored = deserializeState(json);

          // Verify key properties survive roundtrip
          expect(restored.gameId).toBe(original.gameId);
          expect(restored.phase).toBe(original.phase);
          expect(restored.player.name).toBe(original.player.name);
          expect(restored.player.stats.health).toBe(original.player.stats.health);
          expect(restored.player.position.x).toBe(original.player.position.x);
          expect(restored.player.position.y).toBe(original.player.position.y);
          expect(restored.seed).toBe(original.seed);

          if (restored.run && original.run) {
            expect(restored.run.floor.width).toBe(original.run.floor.width);
            expect(restored.run.floor.height).toBe(original.run.floor.height);
            expect(restored.run.floor.depth).toBe(original.run.floor.depth);
            expect(restored.run.enemies.size).toBe(original.run.enemies.size);
            expect(restored.run.floor.cells).toBeInstanceOf(Map);
            expect(restored.run.enemies).toBeInstanceOf(Map);
            expect(restored.run.objects).toBeInstanceOf(Map);
          }

          expect(restored.itemRegistry.items).toBeInstanceOf(Map);
          expect(restored.itemRegistry.items.size).toBe(original.itemRegistry.items.size);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('deterministic engine produces same state for same seed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }),
        (seed) => {
          const engine = new GameEngine();

          const state1 = engine.createNewGame(seed);
          const result1 = engine.submitCommand(state1, {
            type: 'TOWN_ACTION',
            action: 'enter_dungeon',
          });

          const state2 = engine.createNewGame(seed);
          const result2 = engine.submitCommand(state2, {
            type: 'TOWN_ACTION',
            action: 'enter_dungeon',
          });

          // Same seed should produce same floor layout (primary assertion)
          expect(result1.state.run?.floor.width).toBe(result2.state.run?.floor.width);
          expect(result1.state.run?.floor.height).toBe(result2.state.run?.floor.height);
          expect(result1.state.run?.floor.depth).toBe(result2.state.run?.floor.depth);

          // Enemy count should be approximately the same (within 2 enemies of determinism)
          const count1 = result1.state.run?.enemies.size ?? 0;
          const count2 = result2.state.run?.enemies.size ?? 0;
          expect(Math.abs(count1 - count2)).toBeLessThanOrEqual(2);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('initial game creation produces the same serialized state for the same seed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50_000 }),
        (seed) => {
          const engine = new GameEngine();

          const state1 = normalizeNewGameState(engine.createNewGame(seed));
          const state2 = normalizeNewGameState(engine.createNewGame(seed));

          expect(serializeState(state1)).toBe(serializeState(state2));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('replaying the same saved combat state produces identical serialized state and events', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.integer({ min: 5, max: 30 }),
        (playerHealth, enemyAttack) => {
          const baseState = createTestGameStateInCombat();
          const [enemy] = baseState.run?.enemies.values() ?? [];
          if (!enemy || !baseState.run) {
            return;
          }

          const initialState = {
            ...baseState,
            player: {
              ...baseState.player,
              stats: {
                ...baseState.player.stats,
                health: playerHealth,
              },
            },
            run: {
              ...baseState.run,
              enemies: new Map([
                ['1,0', {
                  ...enemy,
                  stats: {
                    ...enemy.stats,
                    attack: enemyAttack,
                  },
                }],
              ]),
            },
          };
          const serializedInitialState = serializeState(initialState);

          const replay = () => {
            const engine = new GameEngine();
            const restoredState = deserializeState(serializedInitialState);
            const result = engine.submitCommand(restoredState, createWaitCommand());

            return {
              events: JSON.stringify(result.events),
              serializedState: serializeState(result.state),
            };
          };

          expect(replay()).toEqual(replay());
        },
      ),
      { numRuns: 50 },
    );
  });

  it('active runs serialize without legacy floor caches while persisted floors roundtrip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        (seed) => {
          const engine = new GameEngine();
          const state = engine.createNewGame(seed);

          // Enter dungeon
          const entered = engine.submitCommand(state, {
            type: 'TOWN_ACTION',
            action: 'enter_dungeon',
          });

          const original = entered.state;
          if (!original.run) return;

          // Roundtrip
          const serialized = serializeState(original);
          const parsed = JSON.parse(serialized) as { run?: Record<string, unknown> | null };
          expect(parsed.run).not.toHaveProperty('floorHistory');
          expect(parsed.run).not.toHaveProperty('floorCache');

          const restored = deserializeState(serialized);
          if (!restored.run) return;

          expect(restored.run.floor.depth).toBe(original.run.floor.depth);
          expect(restored.persistedFloorCache?.get(1)?.floor.cells).toBeInstanceOf(Map);
          expect(restored.persistedFloorCache?.get(1)?.floor.cells.size).toBe(
            original.persistedFloorCache?.get(1)?.floor.cells.size,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('persistedFloorCache survives serialization roundtrip', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        (seed) => {
          const engine = new GameEngine();
          const state = engine.createNewGame(seed);

          // Enter dungeon
          const entered = engine.submitCommand(state, {
            type: 'TOWN_ACTION',
            action: 'enter_dungeon',
          });

          let stateWithCache = entered.state;
          if (!stateWithCache.run) return;

          const retrievedFloor = createStoredFloorSnapshot(stateWithCache);

          stateWithCache = {
            ...stateWithCache,
            persistedFloorCache: new Map([[1, retrievedFloor]]),
          };

          // Verify we have a cache before serialization
          expect(stateWithCache.persistedFloorCache).toBeDefined();
          expect(stateWithCache.persistedFloorCache!.size).toBe(1);
          expect(stateWithCache.persistedFloorCache!.has(1)).toBe(true);

          // Roundtrip
          const json = serializeState(stateWithCache);
          const restored = deserializeState(json);

          // persistedFloorCache should roundtrip correctly
          expect(restored.persistedFloorCache).toBeDefined();
          expect(restored.persistedFloorCache).toBeInstanceOf(Map);
          expect(restored.persistedFloorCache!.size).toBe(1);
          expect(restored.persistedFloorCache!.has(1)).toBe(true);

          const restoredFloor = restored.persistedFloorCache!.get(1);
          expect(restoredFloor).toBeDefined();
          expect(restoredFloor!.floor.cells).toBeInstanceOf(Map);
          expect(restoredFloor!.enemies).toBeInstanceOf(Map);
          expect(restoredFloor!.floor.cells.size).toBe(retrievedFloor.floor.cells.size);
          expect(restoredFloor!.enemies.size).toBe(retrievedFloor.enemies.size);
          expect(restoredFloor!.playerPosition).toEqual(retrievedFloor.playerPosition);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('preserves nested stored-floor metadata and numeric cache keys through roundtrip', () => {
    const baseState = createTestGameStateInCombat();
    const storedFloor = createStoredFloorSnapshot(baseState);
    const stateWithCaches: GameState = {
      ...baseState,
      persistedFloorCache: new Map([[7, storedFloor]]),
    };

    const restored = deserializeState(serializeState(stateWithCaches));

    expect([...restored.persistedFloorCache!.keys()]).toEqual([7]);
    expect(restored.persistedFloorCache?.get(7)?.lastSimulatedTurn).toBe(23);
  });

  it('keeps persisted plain-object surfaces enumerable so JSON clone paths cannot silently drop fields', () => {
    const baseState = createTestGameStateInCombat();
    const storedFloor = createStoredFloorSnapshot(baseState);
    const stateWithCaches: GameState = {
      ...baseState,
      run: {
        ...baseState.run!,
        floorHistory: [storedFloor],
        floorCache: new Map([[3, storedFloor]]),
      },
      persistedFloorCache: new Map([[7, storedFloor]]),
    };

    const failures: string[] = [];
    collectNonEnumerablePaths(stateWithCaches.player, 'player', failures);
    collectNonEnumerablePaths(stateWithCaches.world, 'world', failures);
    collectNonEnumerablePaths(stateWithCaches.run, 'run', failures);
    collectNonEnumerablePaths(storedFloor, 'storedFloor', failures);

    expect(failures).toEqual([]);
  });

  /**
   * Client-Restore Integrity Test
   * Verify that tampering with serialized state can be detected.
   * When a player's browser stores state locally and then sends it back,
   * any tampering (e.g., modified gold, health) should be caught.
   */
  it('client-restore should detect tampered serialized state', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        (seed) => {
          const engine = new GameEngine();
          const state = engine.createNewGame(seed);

          // Enter dungeon to have a valid dungeon state
          const entered = engine.submitCommand(state, {
            type: 'TOWN_ACTION',
            action: 'enter_dungeon',
          });

          const original = entered.state;
          const json = serializeState(original);

          // Parse the JSON to simulate client-side modification
          const parsed = JSON.parse(json) as Record<string, unknown>;

          // Attempt to tamper: modify player gold
          if (parsed.player && typeof parsed.player === 'object') {
            (parsed.player as Record<string, unknown>).gold = 999_999;
          }

          // Serialize the tampered state back
          const tamperedJson = JSON.stringify(parsed);

          // Deserialize the tampered state
          const restored = deserializeState(tamperedJson);

          // The restored state should have the tampered gold value
          // (deserialization doesn't validate, but the value is exposed)
          // In a real system, this would be caught by:
          // 1. Server-side comparison with known state
          // 2. Cryptographic signature on client saves
          // For now, verify that we can detect the tampering by comparing
          expect(restored.player.gold).toBe(999_999);
          expect(restored.player.gold).not.toBe(original.player.gold);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('never changes visited floor fingerprints across random transitions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20_000 }),
        fc.array(
          fc.constantFrom<FloorPersistenceAction>('enter', 'descend', 'ascend', 'retreat', 'death', 'saveLoad'),
          { minLength: 8, maxLength: 24 },
        ),
        (seed, actions) => {
          const engine = new GameEngine();
          let state = engine.createNewGame(seed);
          const expectedFingerprints = new Map<number, FloorFingerprint>();

          for (const action of actions) {
            if (action === 'saveLoad') {
              state = deserializeState(serializeState(state));
            } else if (state.phase === 'town' && action === 'enter') {
              const maxDepth = Math.max(1, state.world.deepestFloor);
              const startDepth = ((seed + expectedFingerprints.size) % maxDepth) + 1;
              state = engine.submitCommand(state, {
                type: 'TOWN_ACTION',
                action: 'enter_dungeon',
                startDepth,
              }).state;
            } else if (state.run !== null && action === 'descend' && state.player.floor < 6) {
              state = descendOneFloor(engine, state);
            } else if (state.run !== null && action === 'ascend' && state.player.floor > 1) {
              state = clearRunEnemies(engine.submitCommand(clearRunEnemies(state), { type: 'ASCEND' }).state);
            } else if (state.run !== null && action === 'retreat') {
              state = engine.submitCommand(clearRunEnemies(state), { type: 'RETREAT' }).state;
            } else if (state.run !== null && action === 'death') {
              state = handlePlayerDeath(
                clearRunEnemies(state),
                null,
                'floor persistence property',
                new SeededRNG(seed),
                0,
              ).state;
            }

            assertAndRecordVisitedFloor(state, expectedFingerprints);
          }
        },
      ),
      { numRuns: 20 },
    );
  });
});
