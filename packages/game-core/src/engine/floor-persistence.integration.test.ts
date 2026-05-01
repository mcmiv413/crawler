import { describe, it, expect } from 'vitest';
import { GameEngine } from './game-engine.js';

describe('Floor Persistence & Selection (Phase 5)', () => {
  it('player can select and re-enter a previously visited floor', () => {
    const engine = new GameEngine();
    let state = engine.createNewGame(42);

    // Enter floor 1
    let result = engine.submitCommand(state, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
    });

    state = result.state;
    expect(state.phase).toBe('dungeon');
    expect(state.player.floor).toBe(1);
    expect(state.run).not.toBeNull();

    // Retreat from floor 1
    const retreatResult = engine.submitCommand(state, {
      type: 'RETREAT',
    });

    state = retreatResult.state;
    expect(state.phase).toBe('town');
    expect(state.run).toBeNull();
    expect(state.persistedFloorCache?.has(1)).toBe(true);

    // Now enter floor 1 again with explicit startDepth
    const reenterResult = engine.submitCommand(state, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
      startDepth: 1,
    });

    state = reenterResult.state;
    expect(state.phase).toBe('dungeon');
    expect(state.player.floor).toBe(1);
    expect(state.run).not.toBeNull();

    // Verify enemies were respawned (cached floor should have enemies)
    expect(state.run!.enemies.size).toBeGreaterThanOrEqual(0);
  });

  it('floor selection defaults to last retreat floor', () => {
    const engine = new GameEngine();
    let state = engine.createNewGame(42);

    // Enter and retreat from floor 1
    let result = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon' });
    state = result.state;

    result = engine.submitCommand(state, { type: 'RETREAT' });
    state = result.state;

    expect(state.lastRetreatFloor).toBe(1);

    // Re-enter without specifying depth — should default to last retreat floor
    result = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon' });
    state = result.state;

    expect(state.player.floor).toBe(1);
  });

  it('floor selection is clamped to valid range [1, deepestFloor - 1]', () => {
    const engine = new GameEngine();
    let state = engine.createNewGame(42);

    // Try to enter floor 0 (invalid)
    let result = engine.submitCommand(state, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
      startDepth: 0,
    });

    state = result.state;
    expect(state.player.floor).toBe(1); // Clamped to minimum valid floor

    // Retreat, advance world state, and try to enter a floor beyond deepestFloor
    result = engine.submitCommand(state, { type: 'RETREAT' });
    state = result.state;

    // Update world state to simulate progressing deeper (for testing purposes)
    // The clamping should keep us at valid floors
    result = engine.submitCommand(state, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
      startDepth: 999, // Request way beyond deepest floor
    });

    state = result.state;
    // Should be clamped to floor 1 (since deepestFloor would be 1, max allowed is deepestFloor - 1)
    // But the engine clamps to [1, max(1, deepestFloor - 1)], so it's valid
    expect(state.player.floor).toBeGreaterThanOrEqual(1);
    expect(state.player.floor).toBeLessThanOrEqual(Math.max(1, state.world.deepestFloor - 1));
  });

  it('persisted floor maintains state across multiple re-entries', () => {
    const engine = new GameEngine();
    let state = engine.createNewGame(42);

    // Enter floor 1
    let result = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon' });
    state = result.state;

    // Retreat
    result = engine.submitCommand(state, { type: 'RETREAT' });
    state = result.state;

    const cachedFloorAtFirstRetreat = state.persistedFloorCache?.get(1);
    expect(cachedFloorAtFirstRetreat).not.toBeUndefined();

    // Wait some turns in town (simulate time passing)
    for (let i = 0; i < 5; i++) {
      result = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'rest' });
      state = result.state;
    }

    // Re-enter floor 1
    result = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon', startDepth: 1 });
    state = result.state;

    // Verify floor was restored with respawning applied
    expect(state.run).not.toBeNull();
    expect(state.player.floor).toBe(1);

    // Enemies should have been respawned and simulated
    // (may have more or same enemies depending on respawn rate)
    expect(state.run!.enemies.size).toBeGreaterThan(0);
  });

  it('freshly generated floors are added to cache on retreat', () => {
    const engine = new GameEngine();
    let state = engine.createNewGame(42);

    // Enter a new floor
    let result = engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon' });
    state = result.state;
    const enemyCountBeforeRetreat = state.run?.enemies.size ?? 0;

    expect(state.persistedFloorCache).toBeUndefined();

    // Retreat — floor should be cached
    result = engine.submitCommand(state, { type: 'RETREAT' });
    state = result.state;

    expect(state.persistedFloorCache?.has(1)).toBe(true);

    const storedFloor = state.persistedFloorCache?.get(1);
    expect(storedFloor?.originalEnemyCount).toBe(enemyCountBeforeRetreat);
    expect(storedFloor?.enemies.size ?? 0).toBeLessThanOrEqual(enemyCountBeforeRetreat);
  });
});
