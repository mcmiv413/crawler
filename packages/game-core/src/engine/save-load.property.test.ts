import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { GameEngine } from './game-engine.js';
import { serializeState, deserializeState } from '../state/serialization.js';

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
      { numRuns: 20 },
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

          // Same seed should produce same floor layout
          expect(result1.state.run?.floor.width).toBe(result2.state.run?.floor.width);
          expect(result1.state.run?.floor.height).toBe(result2.state.run?.floor.height);
          expect(result1.state.run?.floor.depth).toBe(result2.state.run?.floor.depth);
          expect(result1.state.run?.enemies.size).toBe(result2.state.run?.enemies.size);
        },
      ),
      { numRuns: 20 },
    );
  });

  it('floorCache and floorHistory survive serialization roundtrip', () => {
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
          const restored = deserializeState(serializeState(original));
          if (!restored.run) return;

          // floorHistory should roundtrip
          expect(restored.run.floorHistory.length).toBe(original.run.floorHistory.length);
          for (let i = 0; i < original.run.floorHistory.length; i++) {
            const origSf = original.run.floorHistory[i];
            const restSf = restored.run.floorHistory[i];
            expect(restSf.floor.cells).toBeInstanceOf(Map);
            expect(restSf.enemies).toBeInstanceOf(Map);
            expect(restSf.floor.cells.size).toBe(origSf.floor.cells.size);
            expect(restSf.enemies.size).toBe(origSf.enemies.size);
            expect(restSf.playerPosition).toEqual(origSf.playerPosition);
          }

          // floorCache should roundtrip (may be undefined initially)
          if (original.run.floorCache) {
            expect(restored.run.floorCache).toBeDefined();
            expect(restored.run.floorCache).toBeInstanceOf(Map);
            expect(restored.run.floorCache!.size).toBe(original.run.floorCache.size);
            for (const [depth, origSf] of original.run.floorCache) {
              const restSf = restored.run.floorCache!.get(depth);
              expect(restSf).toBeDefined();
              expect(restSf!.floor.cells).toBeInstanceOf(Map);
              expect(restSf!.enemies).toBeInstanceOf(Map);
              expect(restSf!.floor.cells.size).toBe(origSf.floor.cells.size);
            }
          }
        },
      ),
      { numRuns: 20 },
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

          // Simulate having retreated by populating persistedFloorCache
          const retrievedFloor = stateWithCache.run.floorHistory[0];
          if (!retrievedFloor) return;

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
      { numRuns: 20 },
    );
  });
});
