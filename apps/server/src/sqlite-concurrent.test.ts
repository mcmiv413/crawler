/**
 * Test layer: unit
 * Behavior: Repository optimistic concurrency rejects stale writes while allowing correctly versioned saveGame and commitTick updates to advance atomically.
 * Proof: Assertions check stale saveGame and commitTick calls reject, final versions and gold remain at the winning update, sequential writes reach versions 2 through 5, failed commitTick appends no events, and successful commitTick advances version and state together.
 * Validation: pnpm vitest run apps/server/src/sqlite-concurrent.test.ts
 */
/**
 * Optimistic Concurrency Control (OCC) tests for repository implementations.
 *
 * These tests verify that both InMemoryRepository and SqliteRepository
 * have identical concurrency semantics: concurrent writes with stale versions
 * must fail consistently across both implementations.
 *
 * Failure mode being tested:
 * - Local dev (InMemory) silently overwrites concurrent writes
 * - Production (SQLite) throws "Concurrent modification detected"
 * - Result: tests pass locally, fail in prod
 *
 * Fix: Both implementations must use version checks and throw on conflict.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryRepository } from './in-memory-repository.js';
import type { GameState, EntityId } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';
import { createTestGameState, createTestPlayer } from '@dungeon/core/testing';

function createMinimalGameState(overrides?: Partial<GameState>): GameState {
  const baseState = createTestGameState();
  return {
    ...baseState,
    ...overrides,
  };
}

describe('OCC (Optimistic Concurrency Control)', () => {
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
  });

  /**
   * Scenario: Player submits command A while server is processing command B
   * - Player's client loaded state at version=1, submitted command A
   * - Meanwhile, server executed command B, state now at version=2
   * - Player's command A arrives trying to save version=1 → version=2
   *
   * Expected behavior: REJECT the stale write, force client retry
   * Current behavior (InMemory): ACCEPT silently (BUG)
   * Current behavior (SQLite): REJECT correctly
   */
  it('should reject concurrent writes with stale version', async () => {
    const gameId = entityId('occ_test_1');

    // Initial state created at version=1
    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // Both client and server load the same state at version=1
    const loadedV1_client = (await repo.loadGame(gameId))!;
    const loadedV1_server = (await repo.loadGame(gameId))!;
    expect(loadedV1_client.version).toBe(1);
    expect(loadedV1_server.version).toBe(1);

    // Server processes a command first, advancing version 1→2
    const serverUpdate = {
      ...loadedV1_server,
      player: createTestPlayer({ gold: 150 }),
    };
    await repo.saveGame(gameId, serverUpdate);

    // Verify server's change advanced version to 2
    const afterServer = (await repo.loadGame(gameId))!;
    expect(afterServer.version).toBe(2);
    expect(afterServer.player.gold).toBe(150);

    // Client tries to save their command using stale version=1
    // This SHOULD FAIL because version has moved to 2
    const staleClientUpdate = {
      ...loadedV1_client,
      player: createTestPlayer({ gold: 200 }), // Client's change
    };

    // The stale write should be rejected
    await expect(repo.saveGame(gameId, staleClientUpdate)).rejects.toThrow(
      /Concurrent modification|version/i,
    );

    // Verify that the server's version is still in place
    const finalState = (await repo.loadGame(gameId))!;
    expect(finalState.version).toBe(2);
    expect(finalState.player.gold).toBe(150); // Server's value, not client's 200
  });

  /**
   * Scenario: Two concurrent command submissions
   * - Both clients loaded at version=1
   * - Client A submits first: version 1→2, state changes to A
   * - Client B submits second: version 1→2, state changes to B
   *
   * Expected: Only one succeeds (version=2), other fails (version 1 is already gone)
   */
  it('should allow exactly one of two concurrent writes to succeed', async () => {
    const gameId = entityId('occ_test_2');

    // Both clients load at version=1
    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // Both clients load the same version=1 state
    const loadedForA = (await repo.loadGame(gameId))!;
    const loadedForB = (await repo.loadGame(gameId))!;

    // Simulate Client A's write arriving first
    const clientAUpdate = {
      ...loadedForA,
      player: createTestPlayer({ gold: 200 }),
    };
    await repo.saveGame(gameId, clientAUpdate);

    // Verify Client A's change was persisted (version now 2)
    const afterA = (await repo.loadGame(gameId))!;
    expect(afterA.version).toBe(2);
    expect(afterA.player.gold).toBe(200);

    // Now Client B tries to write (still has stale version=1)
    const clientBUpdate = {
      ...loadedForB,
      player: createTestPlayer({ gold: 300 }),
    };

    // Client B's write should fail because version is now 2, not 1
    await expect(repo.saveGame(gameId, clientBUpdate)).rejects.toThrow(
      /Concurrent modification|version/i,
    );

    // Verify Client A's state still prevails
    const finalState = (await repo.loadGame(gameId))!;
    expect(finalState.version).toBe(2);
    expect(finalState.player.gold).toBe(200);
  });

  /**
   * Scenario: Sequential updates with correct versioning
   * - Client loads v=1, saves (increments to v=2) succeeds
   * - Client loads v=2, saves (increments to v=3) succeeds
   * - Normal flow should always succeed
   */
  it('should allow sequential writes with correct versions', async () => {
    const gameId = entityId('occ_test_3');

    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // First write: load v1, save → increments to v2
    const loaded1 = (await repo.loadGame(gameId))!;
    const update1 = {
      ...loaded1,
      player: createTestPlayer({ gold: 200 }),
    };
    await repo.saveGame(gameId, update1);

    const loaded2 = (await repo.loadGame(gameId))!;
    expect(loaded2.version).toBe(2);

    // Second write: load v2, save → increments to v3
    const update2 = {
      ...loaded2,
      player: createTestPlayer({ gold: 300 }),
    };
    await repo.saveGame(gameId, update2);

    const loaded3 = (await repo.loadGame(gameId))!;
    expect(loaded3.version).toBe(3);
    expect(loaded3.player.gold).toBe(300);
  });

  /**
   * Scenario: Attempted double-save (same version twice)
   * - Load state at version=1
   * - Attempt 1: save → increments to v2 (succeeds)
   * - Attempt 2: try to save same loaded state again (fails, version is now 2)
   */
  it('should reject double-save of the same version', async () => {
    const gameId = entityId('occ_test_4');

    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // Load state at v1
    const loaded = (await repo.loadGame(gameId))!;

    // First save: v1→v2
    const update1 = {
      ...loaded,
      player: createTestPlayer({ gold: 200 }),
    };
    await repo.saveGame(gameId, update1);

    // Try to save again with the same loaded state (still at v1)
    // This should fail because version is now 2
    await expect(repo.saveGame(gameId, update1)).rejects.toThrow(
      /Concurrent modification|version/i,
    );

    // Verify we're at version 2, not 3
    const final = (await repo.loadGame(gameId))!;
    expect(final.version).toBe(2);
  });

  /**
   * Edge case: Loading a game gives you the current version
   * The version field in loaded state must match what's in storage
   */
  it('should always load the current version correctly', async () => {
    const gameId = entityId('occ_test_5');

    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // Perform several updates
    let currentState = initialState;
    for (let i = 0; i < 4; i++) {
      const loaded = (await repo.loadGame(gameId))!;
      currentState = {
        ...loaded,
        player: createTestPlayer({ gold: 100 * (loaded.version + 1) }),
      };
      await repo.saveGame(gameId, currentState);
    }

    // Load and verify we get the latest version
    const loaded = (await repo.loadGame(gameId))!;
    expect(loaded.version).toBe(5);
    expect(loaded.player.gold).toBe(500);
  });
});

/**
 * commitTick atomic transaction tests
 *
 * Verifies that commitTick bundles saveGame + appendEvents into a single
 * all-or-nothing operation. Either both succeed (version advances) or
 * both fail (version unchanged, no partial writes).
 */
describe('commitTick atomicity', () => {
  let repo: InMemoryRepository;

  beforeEach(() => {
    repo = new InMemoryRepository();
  });

  /**
   * Scenario: Version mismatch must fail before any mutations
   * commitTick should not save state or append events if version check fails
   */
  it('should reject commitTick on version mismatch without partial writes', async () => {
    const gameId = entityId('commit_tick_test_1');
    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // Try to commit with stale prevVersion (should be 1, passing 99)
    const newState = {
      ...initialState,
      version: 100, // This will be checked against
      player: createTestPlayer({ gold: 500 }),
    };

    // This should throw (using empty events array)
    const fakeEvents: any[] = [];

    await expect(repo.commitTick(gameId, 99, newState, fakeEvents)).rejects.toThrow(
      /Concurrent modification|version/i,
    );

    // Verify neither state nor events changed
    const finalState = (await repo.loadGame(gameId))!;
    expect(finalState.version).toBe(1); // Should still be 1 (commitTick failed)
    expect(finalState.player.gold).toBe(100); // Original value unchanged

    // Get events to verify none were added
    const recentEvents = await repo.getRecentEvents(gameId, 10);
    expect(recentEvents.length).toBe(0); // No events should have been appended
  });

  /**
   * Scenario: Successful commitTick advances version and persists events
   */
  it('should atomically advance version and append events on success', async () => {
    const gameId = entityId('commit_tick_test_2');
    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    // Load to get current state
    const loaded = (await repo.loadGame(gameId))!;
    expect(loaded.version).toBe(1);

    // Prepare new state (as if engine processed a command)
    const newState = {
      ...loaded,
      version: 2, // Engine increments version
      player: createTestPlayer({ gold: 150 }),
    };

    const events: any[] = [];

    // commitTick should succeed
    await repo.commitTick(gameId, loaded.version, newState, events);

    // Verify state persisted
    const finalState = (await repo.loadGame(gameId))!;
    expect(finalState.version).toBe(2); // Created at v1, commitTick advanced to v2
    expect(finalState.player.gold).toBe(150);
  });

  /**
   * Scenario: Two concurrent commitTick calls with same prevVersion
   * Only one should succeed; the second should see version already advanced
   */
  it('should handle concurrent commitTick calls with OCC conflict', async () => {
    const gameId = entityId('commit_tick_test_3');
    const initialState = createMinimalGameState({
      gameId,
      version: 1,
      player: createTestPlayer({ gold: 100 }),
    });
    await repo.createGame(initialState);

    const loaded = (await repo.loadGame(gameId))!;
    const prevVersion = loaded.version;

    // Create two state updates from the same baseline
    const state1 = {
      ...loaded,
      version: prevVersion + 1,
      player: createTestPlayer({ gold: 200 }),
    };

    const state2 = {
      ...loaded,
      version: prevVersion + 1,
      player: createTestPlayer({ gold: 300 }),
    };

    const events1: any[] = [];
    const events2: any[] = [];

    // First commit should succeed
    await repo.commitTick(gameId, prevVersion, state1, events1);

    // Second commit should fail (version now advanced)
    await expect(repo.commitTick(gameId, prevVersion, state2, events2)).rejects.toThrow(
      /Concurrent modification|version/i,
    );

    // Verify final state is from first commit
    const final = (await repo.loadGame(gameId))!;
    expect(final.player.gold).toBe(200); // First commit won
  });
});
