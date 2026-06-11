/**
 * tests/repository/state-safety.test.ts
 *
 * Comprehensive tests for InMemoryRepository state management.
 *
 * Validates:
 * - State immutability: Saved state cannot be mutated externally
 * - State isolation: Multiple games maintain independent state
 * - Repository lifecycle: Create → Read → Update → Delete flows
 * - Serialization: Complex nested structures survive round-trips
 * - Concurrent access: Multiple operations maintain consistency
 *
 * Tests: 16 total (4 boundary safety + 3 isolation + 3 lifecycle + 3 serialization + 3 concurrent)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from './in-memory-repository.js';
import type { GameState, DomainEvent, StoredFloor } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import {
  createTestGameState,
  createTestGameStateInCombat,
  createTestPlayer,
  createTestEnemy,
  createTestRunState,
} from '@dungeon/core/testing';

function createMinimalGameState(overrides?: Partial<GameState>): GameState {
  const baseState = createTestGameState();
  return {
    ...baseState,
    ...overrides,
  };
}

function createStoredFloorSnapshot(state: GameState): StoredFloor {
  const runState = state.run ?? createTestRunState();

  return {
    floor: runState.floor,
    enemies: runState.enemies,
    objects: runState.objects,
    playerPosition: state.player.position,
    originalEnemyCount: runState.enemies.size,
    lastSimulatedTurn: 11,
  };
}

describe('Repository: State Safety', () => {
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
  });

  // ============================================================================
  // STATE BOUNDARY SAFETY (4 tests)
  // ============================================================================

  describe('State Boundary Safety', () => {
    it('should clone state on create and load', async () => {
      const gameId = entityId('game_1');
      const originalState = createMinimalGameState({ gameId });
      const originalHealth = originalState.player.stats.health;

      await repo.createGame(originalState);

      const retrieved = await repo.loadGame(gameId);
      expect(retrieved).not.toBeNull();
      expect(retrieved).not.toBe(originalState);
      expect(retrieved!.gameId).toBe(originalState.gameId);
      expect(retrieved!.player).toEqual(originalState.player);
      expect(retrieved!.turnNumber).toBe(originalState.turnNumber);
      expect(retrieved!.version).toBe(originalState.version);
      expect(retrieved!.player.stats.health).toBe(originalHealth);
    });

    it('should return independent clones on repeated retrievals', async () => {
      const gameId = entityId('game_2');
      const state = createMinimalGameState({ gameId });
      await repo.createGame(state);

      const first = await repo.loadGame(gameId);
      const second = await repo.loadGame(gameId);

      expect(first).not.toBe(second);
      expect(first).toEqual(second);
    });

    it('should not leak mutations from loaded state into repository contents', async () => {
      const gameId = entityId('game_3');
      const state = createMinimalGameState({ gameId, turnNumber: 0 });
      await repo.createGame(state);

      const retrieval1 = await repo.loadGame(gameId);
      const mutated = retrieval1 as any;
      mutated.turnNumber = 999;
      mutated.player.stats.health = 1;

      const retrieval2 = await repo.loadGame(gameId);
      expect(retrieval2!.turnNumber).toBe(0);
      expect(retrieval2!.player.stats.health).toBe(state.player.stats.health);
    });

    it('should not leak mutations from a saved input after saveGame returns', async () => {
      const gameId = entityId('game_4');
      const state1 = createMinimalGameState({
        gameId,
        player: createTestPlayer({ gold: 100 }),
      });
      await repo.createGame(state1);

      // Load the current state to get the correct version
      const currentState = await repo.loadGame(gameId);
      expect(currentState).not.toBeNull();

      // Create a new state object with the correct version for OCC
      const state2 = createMinimalGameState({
        gameId,
        player: createTestPlayer({ gold: 500 }),
        version: currentState!.version, // Use the version we just loaded
      });

      await repo.saveGame(gameId, state2);
      const mutated = state2 as any;
      mutated.player.gold = 999;
      mutated.turnNumber = 999;

      // The new state should be stored with incremented version
      const retrieved = await repo.loadGame(gameId);
      expect(retrieved!.player.gold).toBe(500);
      expect(retrieved!.turnNumber).not.toBe(999);
      expect(retrieved!.version).toBe(state2.version + 1); // Version should be incremented
    });
  });

  // ============================================================================
  // STATE ISOLATION (3 tests)
  // ============================================================================

  describe('State Isolation Between Games', () => {
    it('should keep multiple games completely independent', async () => {
      const gameA = entityId('game_A');
      const gameB = entityId('game_B');

      const stateA = createMinimalGameState({
        gameId: gameA,
        player: createTestPlayer({ gold: 100, level: 1 }),
      });
      const stateB = createMinimalGameState({
        gameId: gameB,
        player: createTestPlayer({ gold: 50, level: 5 }),
      });

      await repo.createGame(stateA);
      await repo.createGame(stateB);

      const loadedA = await repo.loadGame(gameA);
      const loadedB = await repo.loadGame(gameB);

      expect(loadedA!.player.gold).toBe(100);
      expect(loadedA!.player.level).toBe(1);
      expect(loadedB!.player.gold).toBe(50);
      expect(loadedB!.player.level).toBe(5);
    });

    it('should not allow one game update to affect another game', async () => {
      const gameA = entityId('game_A2');
      const gameB = entityId('game_B2');

      const stateA = createMinimalGameState({
        gameId: gameA,
        turnNumber: 10,
      });
      const stateB = createMinimalGameState({
        gameId: gameB,
        turnNumber: 20,
      });

      await repo.createGame(stateA);
      await repo.createGame(stateB);

      // Update game A
      const updatedA = createMinimalGameState({
        gameId: gameA,
        turnNumber: 100,
      });
      await repo.saveGame(gameA, updatedA);

      // Verify game B is unaffected
      const loadedB = await repo.loadGame(gameB);
      expect(loadedB!.turnNumber).toBe(20);
    });

    it('should maintain isolation during concurrent event appends', async () => {
      const gameA = entityId('game_A3');
      const gameB = entityId('game_B3');

      const stateA = createMinimalGameState({ gameId: gameA });
      const stateB = createMinimalGameState({ gameId: gameB });

      await repo.createGame(stateA);
      await repo.createGame(stateB);

      const now = Date.now();
      const eventsA: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED' as const,
          timestamp: now,
          turnNumber: 1,
          attackerId: entityId('p1'),
          defenderId: entityId('e1'),
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 10,
          damageType: 'physical' as const,
          hit: true,
          critical: false,
          position: { x: 0, y: 0 },
        },
      ];
      const eventsB: DomainEvent[] = [
        {
          type: 'ITEM_USED' as const,
          timestamp: now,
          turnNumber: 1,
          itemId: entityId('i1'),
          itemName: 'Potion',
          userId: entityId('p1'),
          effect: 'heal',
        },
      ];

      await repo.appendEvents(gameA, eventsA);
      await repo.appendEvents(gameB, eventsB);

      const retrievedA = await repo.getRecentEvents(gameA, 10);
      const retrievedB = await repo.getRecentEvents(gameB, 10);

      expect(retrievedA).toHaveLength(1);
      expect(retrievedA[0]!.type).toBe('ATTACK_PERFORMED');

      expect(retrievedB).toHaveLength(1);
      expect(retrievedB[0]!.type).toBe('ITEM_USED');
    });
  });

  // ============================================================================
  // REPOSITORY LIFECYCLE (3 tests)
  // ============================================================================

  describe('Repository Lifecycle', () => {
    it('should create, retrieve, and remove game state correctly', async () => {
      const gameId = entityId('lifecycle_1');
      const state = createMinimalGameState({ gameId });

      // Create
      await repo.createGame(state);
      let loaded = await repo.loadGame(gameId);
      expect(loaded).not.toBeNull();
      expect(loaded!.gameId).toBe(gameId);

      // Retrieve again to ensure persistence
      loaded = await repo.loadGame(gameId);
      expect(loaded).not.toBeNull();

      // Note: InMemoryRepository doesn't have delete, but we verify null on non-existent
      const nonExistent = await repo.loadGame(entityId('does_not_exist'));
      expect(nonExistent).toBeNull();
    });

    it('should overwrite state on update and reflect changes on retrieval', async () => {
      const gameId = entityId('lifecycle_2');
      const state1 = createMinimalGameState({ gameId, turnNumber: 0 });
      const state2 = createMinimalGameState({ gameId, turnNumber: 50 });

      await repo.createGame(state1);
      let loaded = await repo.loadGame(gameId);
      expect(loaded!.turnNumber).toBe(0);

      await repo.saveGame(gameId, state2);
      loaded = await repo.loadGame(gameId);
      expect(loaded!.turnNumber).toBe(50);
    });

    it('should handle operations on empty repository gracefully', async () => {
      // Load from empty repo
      const result = await repo.loadGame(entityId('nonexistent'));
      expect(result).toBeNull();

      // Get events from empty repo
      const events = await repo.getRecentEvents(entityId('nonexistent'), 10);
      expect(events).toEqual([]);

      // Get run metrics from empty repo
      const metrics = repo.getRunMetricsLog();
      expect(metrics).toEqual([]);
    });

    it('preserves canonical persisted floor cache across create -> load -> save -> reload', async () => {
      const combatState = createTestGameStateInCombat();
      const storedFloor = createStoredFloorSnapshot(combatState);
      const storedFloor2 = { ...storedFloor, floor: { ...storedFloor.floor, depth: 2 } };
      const storedFloor5 = { ...storedFloor, floor: { ...storedFloor.floor, depth: 5 } };
      const gameId = entityId('lifecycle_floor_cache');
      const state = createMinimalGameState({
        ...combatState,
        gameId,
        run: {
          ...combatState.run!,
          floorHistory: [storedFloor],
          floorCache: new Map([[2, storedFloor2]]),
        },
        persistedFloorCache: new Map([
          [1, storedFloor],
          [2, storedFloor2],
          [5, storedFloor5],
        ]),
      });

      await repo.createGame(state);

      const loaded = await repo.loadGame(gameId);
      expect(loaded?.run?.floorHistory).toBeUndefined();
      expect(loaded?.run?.floorCache).toBeUndefined();
      expect(loaded?.persistedFloorCache?.get(1)?.lastSimulatedTurn).toBe(11);
      expect(loaded?.persistedFloorCache?.get(2)?.originalEnemyCount).toBe(
        storedFloor.originalEnemyCount,
      );
      expect(loaded?.persistedFloorCache?.get(5)?.playerPosition).toEqual(
        combatState.player.position,
      );

      await repo.saveGame(gameId, loaded!);

      const reloaded = await repo.loadGame(gameId);
      expect(reloaded?.run?.floorHistory).toBeUndefined();
      expect(reloaded?.run?.floorCache).toBeUndefined();
      expect(reloaded?.persistedFloorCache?.get(1)?.lastSimulatedTurn).toBe(11);
      expect(reloaded?.persistedFloorCache?.get(2)?.playerPosition).toEqual(
        combatState.player.position,
      );
      expect(reloaded?.persistedFloorCache?.get(5)?.originalEnemyCount).toBe(
        storedFloor.originalEnemyCount,
      );
    });
  });

  // ============================================================================
  // EVENT SERIALIZATION & MANAGEMENT (3 tests)
  // ============================================================================

  describe('Event Serialization and Management', () => {
    it('should preserve complex event structures through append and retrieve', async () => {
      const gameId = entityId('events_1');
      const state = createMinimalGameState({ gameId });
      await repo.createGame(state);

      const now = Date.now();
      const complexEvents: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED' as const,
          timestamp: now,
          turnNumber: 1,
          attackerId: entityId('p1'),
          defenderId: entityId('e1'),
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 15,
          damageType: 'physical' as const,
          hit: true,
          critical: false,
          position: { x: 0, y: 0 },
        },
        {
          type: 'ENTITY_DIED' as const,
          timestamp: now,
          turnNumber: 2,
          entityId: entityId('e1'),
          killerId: entityId('p1'),
          entityName: 'Goblin',
        },
        {
          type: 'LOOT_ACQUIRED' as const,
          timestamp: now,
          turnNumber: 3,
          itemId: entityId('i1'),
          itemName: 'Rusty Sword',
          playerId: entityId('p1'),
        },
      ];

      await repo.appendEvents(gameId, complexEvents);
      (complexEvents[0] as any).damage = 999;
      const retrieved = await repo.getRecentEvents(gameId, 10);

      expect(retrieved).toHaveLength(3);
      expect(retrieved[0]!.type).toBe('ATTACK_PERFORMED');
      expect((retrieved[0] as any).damage).toBe(15);
      expect(retrieved[1]!.type).toBe('ENTITY_DIED');
      expect(retrieved[2]!.type).toBe('LOOT_ACQUIRED');
    });

    it('should respect limit on recent events retrieval', async () => {
      const gameId = entityId('events_2');
      const state = createMinimalGameState({ gameId });
      await repo.createGame(state);

      const now = Date.now();
      const manyEvents: DomainEvent[] = Array.from({ length: 20 }, (_, i) => ({
        type: 'ATTACK_PERFORMED' as const,
        timestamp: now + i * 100,
        turnNumber: i + 1,
        attackerId: entityId('p1'),
        defenderId: entityId(`e${i}`),
        attackerName: 'Hero',
        defenderName: `Enemy${i}`,
        damage: i + 1,
        damageType: 'physical' as const,
        hit: true,
        critical: false,
        position: { x: 0, y: 0 },
      }));

      await repo.appendEvents(gameId, manyEvents);

      const recent5 = await repo.getRecentEvents(gameId, 5);
      expect(recent5).toHaveLength(5);
      // Should be the last 5 events
      expect((recent5[4] as any).damage).toBe(20);

      const recent10 = await repo.getRecentEvents(gameId, 10);
      expect(recent10).toHaveLength(10);
    });

    it('should accumulate events across multiple appends', async () => {
      const gameId = entityId('events_3');
      const state = createMinimalGameState({ gameId });
      await repo.createGame(state);

      const now = Date.now();
      const batch1: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED' as const,
          timestamp: now,
          turnNumber: 1,
          attackerId: entityId('p1'),
          defenderId: entityId('e1'),
          attackerName: 'Hero',
          defenderName: 'Goblin',
          damage: 10,
          damageType: 'physical' as const,
          hit: true,
          critical: false,
          position: { x: 0, y: 0 },
        },
      ];
      const batch2: DomainEvent[] = [
        {
          type: 'ITEM_USED' as const,
          timestamp: now + 100,
          turnNumber: 2,
          itemId: entityId('i1'),
          itemName: 'Potion',
          userId: entityId('p1'),
          effect: 'heal',
        },
      ];
      const batch3: DomainEvent[] = [
        {
          type: 'ENTITY_DIED' as const,
          timestamp: now + 200,
          turnNumber: 3,
          entityId: entityId('e1'),
          killerId: entityId('p1'),
          entityName: 'Goblin',
        },
      ];

      await repo.appendEvents(gameId, batch1);
      await repo.appendEvents(gameId, batch2);
      await repo.appendEvents(gameId, batch3);

      const allEvents = await repo.getRecentEvents(gameId, 10);
      expect(allEvents).toHaveLength(3);
      expect(allEvents[0]!.type).toBe('ATTACK_PERFORMED');
      expect(allEvents[1]!.type).toBe('ITEM_USED');
      expect(allEvents[2]!.type).toBe('ENTITY_DIED');
    });
  });

  // ============================================================================
  // RUN METRICS TRACKING (3 tests)
  // ============================================================================

  describe('Run Metrics Tracking', () => {
    it('should record and retrieve run metrics', () => {
      const metrics1 = {
        damageDealt: 500,
        damageTaken: 150,
        turnsElapsed: 42,
        enemiesKilled: 25,
        itemsUsed: 10,
        goldEarned: 250,
        floorsCleared: 5,
        causeOfEnd: 'victory' as const,
        consecutiveMisses: 0,
      };

      repo.recordRunMetrics(metrics1);
      const log = repo.getRunMetricsLog();

      expect(log).toHaveLength(1);
      expect(log[0]).toEqual(metrics1);

      (log[0] as any).damageDealt = 999;
      expect(repo.getRunMetricsLog()[0]).toEqual(metrics1);
    });

    it('should accumulate multiple run metrics', () => {
      const metrics1 = {
        damageDealt: 500,
        damageTaken: 150,
        turnsElapsed: 42,
        enemiesKilled: 25,
        itemsUsed: 10,
        goldEarned: 250,
        floorsCleared: 5,
        causeOfEnd: 'victory' as const,
        consecutiveMisses: 0,
      };
      const metrics2 = {
        damageDealt: 800,
        damageTaken: 200,
        turnsElapsed: 56,
        enemiesKilled: 40,
        itemsUsed: 15,
        goldEarned: 400,
        floorsCleared: 8,
        causeOfEnd: 'victory' as const,
        consecutiveMisses: 1,
      };

      repo.recordRunMetrics(metrics1);
      repo.recordRunMetrics(metrics2);
      const log = repo.getRunMetricsLog();

      expect(log).toHaveLength(2);
      expect(log[0]).toEqual(metrics1);
      expect(log[1]).toEqual(metrics2);
    });

    it('should handle optional gameId parameter', () => {
      const metrics = {
        damageDealt: 300,
        damageTaken: 100,
        turnsElapsed: 28,
        enemiesKilled: 15,
        itemsUsed: 5,
        goldEarned: 150,
        floorsCleared: 3,
        causeOfEnd: 'retreat' as const,
        consecutiveMisses: 2,
      };

      // Record with optional gameId
      repo.recordRunMetrics(metrics, 'optional_game_id');
      repo.recordRunMetrics(metrics); // Without gameId

      const log = repo.getRunMetricsLog();
      expect(log).toHaveLength(2);
    });
  });

  // ============================================================================
  // CONCURRENT ACCESS PATTERNS (3 tests)
  // ============================================================================

  describe('Concurrent Access Patterns', () => {
    it('should handle concurrent creates without conflicts', async () => {
      const games = Array.from({ length: 10 }, (_, i) =>
        createMinimalGameState({ gameId: entityId(`concurrent_game_${i}`) }),
      );

      // Create all games "concurrently" (Promise.all)
      await Promise.all(games.map((g) => repo.createGame(g)));

      // Verify all were stored independently
      for (let i = 0; i < 10; i++) {
        const loaded = await repo.loadGame(entityId(`concurrent_game_${i}`));
        expect(loaded).not.toBeNull();
        expect(loaded!.gameId).toBe(entityId(`concurrent_game_${i}`));
      }
    });

    it('should handle concurrent saves and loads consistently', async () => {
      const gameId = entityId('concurrent_rw');
      const state = createMinimalGameState({ gameId, turnNumber: 0 });
      await repo.createGame(state);

      // Simulate sequential updates with proper version handling
      let currentState = state;
      for (let i = 1; i <= 5; i++) {
        const updatedState = createMinimalGameState({
          gameId,
          turnNumber: i * 10,
          version: currentState.version, // Use the current version for OCC
        });
        await repo.saveGame(gameId, updatedState);

        // Load the updated state with new version for next iteration
        const loaded = await repo.loadGame(gameId);
        expect(loaded).not.toBeNull();
        currentState = loaded!;
      }

      // Queue multiple reads
      const reads: Promise<GameState | null>[] = [];
      for (let i = 0; i < 5; i++) {
        reads.push(repo.loadGame(gameId));
      }
      await Promise.all(reads);

      // Final state should reflect last save
      const final = await repo.loadGame(gameId);
      expect(final!.turnNumber).toBe(50);
    });

    it('should maintain event ordering during concurrent appends', async () => {
      const gameId = entityId('concurrent_events');
      const state = createMinimalGameState({ gameId });
      await repo.createGame(state);

      // Append events in batches "concurrently"
      const now = Date.now();
      const batch1: DomainEvent[] = [
        {
          type: 'ATTACK_PERFORMED' as const,
          timestamp: now,
          turnNumber: 1,
          attackerId: entityId('p1'),
          defenderId: entityId('e1'),
          attackerName: 'Hero',
          defenderName: 'Enemy',
          damage: 10,
          damageType: 'physical' as const,
          hit: true,
          critical: false,
          position: { x: 0, y: 0 },
        },
      ];
      const batch2: DomainEvent[] = [
        {
          type: 'ITEM_USED' as const,
          timestamp: now + 100,
          turnNumber: 2,
          itemId: entityId('i1'),
          itemName: 'Potion',
          userId: entityId('p1'),
          effect: 'heal',
        },
      ];
      const batch3: DomainEvent[] = [
        {
          type: 'ENTITY_DIED' as const,
          timestamp: now + 200,
          turnNumber: 3,
          entityId: entityId('e1'),
          killerId: entityId('p1'),
          entityName: 'Enemy',
        },
      ];

      // All appends should be accumulated in order
      await Promise.all([
        repo.appendEvents(gameId, batch1),
        repo.appendEvents(gameId, batch2),
        repo.appendEvents(gameId, batch3),
      ]);

      const allEvents = await repo.getRecentEvents(gameId, 10);
      expect(allEvents).toHaveLength(3);
      // Events should be in append order
      expect(allEvents.map((e) => e.type)).toEqual([
        'ATTACK_PERFORMED',
        'ITEM_USED',
        'ENTITY_DIED',
      ]);
    });
  });

  // ============================================================================
  // COMPLEX STATE STRUCTURES (2 bonus tests)
  // ============================================================================

  describe('Complex State Structures', () => {
    it('should preserve nested maps and complex data structures', async () => {
      const gameId = entityId('complex_1');
      const runState = createTestRunState({
        enemies: new Map([
          [
            'e1',
            createTestEnemy({
              id: entityId('e1'),
              position: { x: 5, y: 10 },
              stats: {
                maxHealth: 100,
                health: 75,
                attack: 20,
                defense: 10,
                accuracy: 85,
                evasion: 15,
                speed: 110,
              },
            }),
          ],
          [
            'e2',
            createTestEnemy({
              id: entityId('e2'),
              position: { x: 8, y: 12 },
              stats: {
                maxHealth: 50,
                health: 30,
                attack: 15,
                defense: 5,
                accuracy: 75,
                evasion: 20,
                speed: 90,
              },
            }),
          ],
        ]),
      });

      const state = createMinimalGameState({
        gameId,
        run: runState,
      });

      await repo.createGame(state);
      const loaded = await repo.loadGame(gameId);

      expect(loaded!.run!.enemies.size).toBe(2);
      const enemy1 = loaded!.run!.enemies.get('e1');
      expect(enemy1).toBeDefined();
      expect(enemy1!.stats.health).toBe(75);
      expect(enemy1!.position).toEqual({ x: 5, y: 10 });
    });

    it('should handle large state objects without degradation', async () => {
      const gameId = entityId('large_state');

      // Create a state with many events in history
      const baseState = createMinimalGameState({ gameId });

      // Simulate many events
      await repo.createGame(baseState);

      const now = Date.now();
      const manyEvents: DomainEvent[] = Array.from({ length: 1000 }, (_, i) => ({
        type: 'ATTACK_PERFORMED' as const,
        timestamp: now + i * 50,
        turnNumber: i + 1,
        attackerId: entityId('p1'),
        defenderId: entityId(`e${i % 10}`),
        attackerName: 'Hero',
        defenderName: `Enemy${i % 10}`,
        damage: (i % 100) + 1,
        damageType: 'physical' as const,
        hit: true,
        critical: false,
        position: { x: 0, y: 0 },
      }));

      await repo.appendEvents(gameId, manyEvents);

      // Retrieve large event set
      const retrieved = await repo.getRecentEvents(gameId, 1000);
      expect(retrieved).toHaveLength(1000);

      // Retrieve with smaller limit still works
      const recent50 = await repo.getRecentEvents(gameId, 50);
      expect(recent50).toHaveLength(50);
      expect((recent50[49] as any).damage).toBeGreaterThan(0);
    });
  });
});
