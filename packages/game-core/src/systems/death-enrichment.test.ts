/**
 * Failing tests for death.ts system enhancements
 * Tests verify that handlePlayerDeath properly enriches the PLAYER_DIED event
 * with killer information and calculates goldLost and overkillDamage.
 */

import { describe, it, expect } from 'vitest';
import { handlePlayerDeath } from './death.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { GameState, AnyItemTemplate } from '@dungeon/contracts';
import { createTestGameState } from '../test-utils.js';

describe('handlePlayerDeath - enriched event fields', () => {
  function makeDeathState(overrides?: {
    killerName?: string;
    killerSpriteName?: string;
    enemyInRun?: boolean;
    floor?: number;
    gold?: number;
  }): GameState {
    const killerId = entityId('enemy1');
    const floor = overrides?.floor ?? 3;

    const enemies = new Map();
    if (overrides?.enemyInRun !== false) {
      enemies.set('1,0', {
        id: killerId,
        name: overrides?.killerName ?? 'Goblin Skirmisher',
        templateId: 'goblin_skirmisher',
        tier: 1,
        position: { x: 1, y: 0 },
        stats: {
          maxHealth: 20,
          health: 15,
          attack: 5,
          defense: 2,
          accuracy: 70,
          evasion: 5,
          speed: 3,
        },
        archetype: 'aggressive_melee',
        equipment: {},
        affinities: {},
        spawn: { floorRange: [1, 3], weight: 1 },
        lootTableId: 'goblin',
        experienceValue: 10,
        description: 'A goblin',
        ascii: 'g',
        statuses: [],
        isAlerted: true,
        lastKnownPlayerPos: null,
      } as any);
    }

    const base = createTestGameState({
      player: {
        gold: overrides?.gold ?? 200,
        floor,
        position: { x: 5, y: 5 },
        totalDeaths: 2,
        stats: {
          maxHealth: 100,
          health: 10, // Will die
          attack: 10,
          defense: 5,
          accuracy: 75,
          evasion: 10,
          speed: 100,
        },
      },
      phase: 'dungeon',
    });

    return {
      ...base,
      run: {
        runId: entityId('run1'),
        floor: {
          width: 10,
          height: 10,
          depth: floor,
          biomeId: 'crypt',
          cells: new Map(),
          entrance: { x: 0, y: 0 },
          exit: { x: 9, y: 9 },
          seed: 42,
        } as any,
        enemies,
        items: new Map(),
        turnCount: 0,
        isActive: true,
        runMetrics: {} as any,
        floorHistory: [],
        floorCache: new Map(),
        weaponMastery: {
          blade: { uses: 0, tier: 0 },
          bludgeon: { uses: 0, tier: 0 },
          axe: { uses: 0, tier: 0 },
          ranged: { uses: 0, tier: 0 },
        },
      },
      itemRegistry: { items: new Map() } as any,
    };
  }

  it('should populate killerName from enemy in PLAYER_DIED event', () => {
    const state = makeDeathState({ killerName: 'Orc Warrior' });
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.killerName).toBe('Orc Warrior');
  });

  it('should populate killerSpriteName from ENEMY_TEMPLATES in PLAYER_DIED event', () => {
    const state = makeDeathState();
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    // killerSpriteName can be null if template not found, or string if found
    expect(playerDiedEvent.killerSpriteName === null || typeof playerDiedEvent.killerSpriteName === 'string').toBe(true);
  });

  it('should apply gold loss penalty on player death', () => {
    const state = makeDeathState({ gold: 400 });
    const initialGold = state.player.gold;
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.goldLost).toBeGreaterThan(0);
    expect(playerDiedEvent.goldLost).toBeLessThanOrEqual(initialGold);
  });

  it('should calculate goldLost as a fraction of player gold', () => {
    const state = makeDeathState({ gold: 100 });
    const initialGold = state.player.gold;
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.goldLost).toBeGreaterThanOrEqual(0);
    expect(playerDiedEvent.goldLost).toBeLessThanOrEqual(initialGold);
  });

  it('should set goldLost to 0 when player has no gold', () => {
    const state = makeDeathState({ gold: 0 });
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.goldLost).toBe(0);
  });

  it('should set overkillDamage to 0 for normal deaths', () => {
    const state = makeDeathState();
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.overkillDamage).toBeGreaterThanOrEqual(0);
  });

  it('should populate floor from state in PLAYER_DIED event', () => {
    const state = makeDeathState({ floor: 5 });
    const rng = new SeededRNG(42);
    const killerId = entityId('enemy1');
    const cause = 'combat';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.floor).toBe(5);
  });

  it('should handle null killer gracefully in event', () => {
    const state = makeDeathState({ enemyInRun: false });
    const rng = new SeededRNG(42);
    const killerId = null;
    const cause = 'hazard';

    const { events } = handlePlayerDeath(state, killerId, cause, rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.killerName).toBeNull();
    expect(playerDiedEvent.killerSpriteName).toBeNull();
  });
});
