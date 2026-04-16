import { describe, it, expect } from 'vitest';
import { handlePlayerDeath } from './death.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { GameState } from '@dungeon/contracts';
import { createTestGameState } from '../test-utils.js';
import { CRYPT_BIOME } from '@dungeon/content';

/**
 * TDD Test Suite: Trap Hazards in Death Attribution
 * 
 * These tests ensure that when the player dies to a trap hazard (not an enemy),
 * the game over screen correctly attributes the death to the hazard rather than
 * an enemy, and displays the hazard name as the killer.
 */

function createTestGameStateWithRun(overrides?: {
  player?: Partial<any>;
  phase?: string;
  floor?: number;
  turnCount?: number;
}): GameState {
  const floor = overrides?.floor ?? 1;
  const baseState = createTestGameState({
    player: {
      position: { x: 5, y: 5 },
      floor,
      ...overrides?.player,
    },
    phase: (overrides?.phase ?? 'dungeon') as any,
  });

  return {
    ...baseState,
    run: {
      runId: entityId('run1'),
      floor: {
        width: 10,
        height: 10,
        depth: floor,
        biomeId: 'crypt',
        cells: Array(100).fill({ type: 'floor' }),
        entrance: { x: 0, y: 0 },
        exit: { x: 9, y: 9 },
        seed: 42,
      } as any,
      enemies: new Map(),
      items: new Map(),
      objects: new Map(),
      turnCount: overrides?.turnCount ?? 0,
      isActive: true,
      runMetrics: {
        causedEnd: null,
        floorsCleared: 0,
        enemiesKilled: 0,
        damageDealt: 0,
        damageTaken: 0,
        goldEarned: 0,
        itemsCollected: 0,
        turnsPlayed: 0,
        abilitiesUsed: 0,
      } as any,
      floorHistory: [],
      floorCache: new Map(),
    } as any,
  };
}

describe('Trap Hazard Death Attribution', () => {
  /**
   * Test 1: Player dies to trap hazard - killer name should be trap, not enemy
   * 
   * When a player steps on a trap hazard and takes overkill damage from it,
   * the PlayerDiedEvent should have killerName set to the trap name, not null
   * or an enemy name.
   */
  it('should attribute death to trap hazard when player steps on trap', () => {
    const trapId = 'spike_trap_1';
    let state = createTestGameStateWithRun({
      player: {
        position: { x: 5, y: 5 },
        gold: 100,
        floor: 1,
      },
      phase: 'dungeon',
    });

    // Manually set player health to 10 to make trap damage lethal
    state.player.stats.health = 10;
    state.player.stats.maxHealth = 100;

    // Simulate trap triggering with 50 damage (causing 40 overkill)
    const result = handlePlayerDeath(
      state,
      { type: 'TRAP_HAZARD', hazardId: trapId, hazardName: 'Spike Trap', damage: 50 }
    );

    const playerDiedEvent = result.events.find((e) => e.type === 'PLAYER_DIED');
    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent?.killerName).toBe('Spike Trap');
    expect(playerDiedEvent?.killerSpriteName).toBe(null);
  });

  /**
   * Test 2: Game over screen shows hazard as cause, not enemy
   * 
   * The death context should expose the hazard as the killer, not look for
   * an enemy in the run state.
   */
  it('should populate death context with trap hazard name as killer', () => {
    const trapId = 'lava_pool_1';
    let state = createTestGameStateWithRun({
      player: {
        position: { x: 3, y: 7 },
        gold: 250,
        floor: 5,
      },
      phase: 'dungeon',
    });

    state.player.totalDeaths = 1;
    state.player.stats.health = 10;
    state.player.stats.maxHealth = 100;

    // Trap deals 25 damage (causing 15 overkill) - below permadeath threshold
    const result = handlePlayerDeath(
      state,
      { type: 'TRAP_HAZARD', hazardId: trapId, hazardName: 'Lava Pool', damage: 25 }
    );

    const playerDiedEvent = result.events.find((e) => e.type === 'PLAYER_DIED');
    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent?.killerName).toBe('Lava Pool');
    expect(playerDiedEvent?.overkillDamage).toBeGreaterThan(0);
  });

  /**
   * Test 3: Trap hazard death still calculates overkill correctly
   * 
   * Overkill should be (damage - current health), not affected by whether
   * the source is a trap or an enemy.
   */
  it('should calculate overkill damage correctly for trap hazards', () => {
    let state = createTestGameStateWithRun({
      player: { gold: 50, floor: 2 },
      phase: 'dungeon',
    });

    state.player.stats.health = 15;
    state.player.stats.maxHealth = 100;

    // Trap deals 50 damage, player has 15 health → 35 overkill
    const result = handlePlayerDeath(
      state,
      { type: 'TRAP_HAZARD', hazardId: 'pit', hazardName: 'Pit Trap', damage: 50 }
    );

    const playerDiedEvent = result.events.find((e) => e.type === 'PLAYER_DIED');
    expect(playerDiedEvent?.overkillDamage).toBeGreaterThan(20);
    expect(playerDiedEvent?.overkillDamage).toBeLessThan(50);
  });

  /**
   * Test 4: Trap hazard death respects permadeath thresholds
   * 
   * Even if death is caused by a trap, permadeath checks should still apply.
   */
  it('should trigger permadeath for trap hazard if overkill exceeds threshold', () => {
    let state = createTestGameStateWithRun({
      player: {
        gold: 50,
        floor: 1,
      },
      phase: 'dungeon',
    });

    state.player.totalDeaths = 10; // High death count
    state.player.stats.health = 10;
    state.player.stats.maxHealth = 50;

    // Trap deals 100 damage (90 overkill), high permadeath counter → should trigger
    const result = handlePlayerDeath(
      state,
      { type: 'TRAP_HAZARD', hazardId: 'spike_pit', hazardName: 'Spiked Pit', damage: 100 }
    );

    // Check if permadeath was triggered or not based on thresholds
    expect(result.state.phase).toBe('game_over');
    const permadeathEvent = result.events.find((e) => e.type === 'PERMADEATH');
    expect(permadeathEvent).toBeDefined();
  });

  /**
   * Test 5: Trap hazard in game over context should not reference enemy
   * 
   * When building the game view after a trap hazard death, the killer
   * should be the trap name, not pulled from an enemy template.
   */
  it('should not look for enemy sprite when death is from trap hazard', () => {
    let state = createTestGameStateWithRun({
      player: { gold: 100, floor: 3 },
      phase: 'dungeon',
    });

    state.player.stats.health = 60;
    state.player.stats.maxHealth = 100;

    // Trap deals 30 damage - below permadeath threshold (about 30 at max health 100)
    const result = handlePlayerDeath(
      state,
      { type: 'TRAP_HAZARD', hazardId: 'fire_trap', hazardName: 'Fire Trap', damage: 30 }
    );

    const playerDiedEvent = result.events.find((e) => e.type === 'PLAYER_DIED');
    expect(playerDiedEvent).toBeDefined();
    
    // Sprite name should be null for trap hazards
    expect(playerDiedEvent?.killerSpriteName).toBe(null);
    // But name should always be set
    expect(playerDiedEvent?.killerName).toBe('Fire Trap');
  });

  /**
   * Test 6: Hazard death should emit PLAYER_DIED event (not a different event)
   * 
   * The event type and structure should be consistent regardless of source.
   */
  it('should emit PLAYER_DIED event for hazard deaths', () => {
    let state = createTestGameStateWithRun({
      player: { gold: 75, floor: 2 },
      phase: 'dungeon',
    });

    state.player.stats.health = 30;
    state.player.stats.maxHealth = 100;

    const result = handlePlayerDeath(
      state,
      { type: 'TRAP_HAZARD', hazardId: 'dart_trap', hazardName: 'Dart Trap', damage: 60 }
    );

    const playerDiedEvents = result.events.filter((e) => e.type === 'PLAYER_DIED');
    expect(playerDiedEvents.length).toBeGreaterThan(0);
    expect(playerDiedEvents.length).toBeLessThanOrEqual(1);
    expect(playerDiedEvents[0].killerName).toBe('Dart Trap');
  });
});
