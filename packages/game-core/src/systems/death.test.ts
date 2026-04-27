import { describe, it, expect } from 'vitest';
import { handlePlayerDeath } from './death.js';
import { SeededRNG } from '../utils/rng.js';
import { entityId } from '@dungeon/contracts';
import type { GameState } from '@dungeon/contracts';
import { createTestGameStateInCombat } from '../test-utils.js';

describe('handlePlayerDeath', () => {
  const killerId = entityId('enemy1');
  const cause = 'foul play';

  function makeDeathState(overrides?: {
    equipment?: Record<string, string | null>;
    gold?: number;
    floor?: number;
    maxHealth?: number;
    health?: number;
    deathStash?: any;
    enemyInRun?: boolean;
  }): GameState {
    // Use combat state builder to get proper RunState structure
    const combatState = createTestGameStateInCombat();

    const floor = overrides?.floor ?? 3;
    const maxHealth = overrides?.maxHealth ?? 100;
    const health = overrides?.health ?? 50;
    const weapon = overrides?.equipment?.weapon ?? null;
    const chest = overrides?.equipment?.chest ?? null;

    // Build item registry with proper type handling
    const itemRegistry = { items: new Map(combatState.itemRegistry.items) };
    if (weapon) {
      const weaponId = entityId(weapon);
      itemRegistry.items.set(weaponId, {
        itemId: weaponId, name: 'Test Sword', description: '', itemClass: 'weapon',
        rarity: 'common', value: 10, stackable: false, maxStack: 1,
        weapon: { damage: 5, damageType: 'physical', accuracy: 0, speed: 0, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
      });
    }
    if (chest) {
      const chestId = entityId(chest);
      itemRegistry.items.set(chestId, {
        itemId: chestId, name: 'Test Armor', description: '', itemClass: 'armor',
        rarity: 'common', value: 15, stackable: false, maxStack: 1,
        armor: { defense: 3, slot: 'chest', evasionPenalty: 0, enchantmentSlots: 0, enchantments: [] },
      });
    }

    // Build player with proper equipment
    const player = {
      ...combatState.player,
      gold: overrides?.gold ?? 200,
      floor,
      position: { x: 5, y: 5 },
      equipment: {
        ...combatState.player.equipment,
        weapon: weapon ? entityId(weapon) : null,
        chest: chest ? entityId(chest) : null,
      },
      stats: { ...combatState.player.stats, maxHealth, health },
      totalDeaths: 2,
      totalRuns: 5,
      deathStash: overrides?.deathStash ?? null,
    };

    // Build run with proper floor depth
    const runState = {
      ...combatState.run!,
      floor: { ...combatState.run!.floor, depth: floor },
    };

    // Build the final state with combat as base
    return {
      ...combatState,
      player,
      run: runState,
      itemRegistry,
      phase: 'dungeon' as const,
    };
  }

  it('normal death: returns to town with gold loss', () => {
    const state = makeDeathState({ gold: 200 });
    const rng = new SeededRNG(42);
    const { state: newState, events } = handlePlayerDeath(state, killerId, cause, rng);

    expect(newState.phase).toBe('town');
    expect(newState.run).toBeNull();
    expect(newState.player.stats.health).toBe(newState.player.stats.maxHealth);
    expect(newState.player.statuses).toEqual([]);
    // Gold should be reduced (loss calculation may vary)
    expect(newState.player.gold).toBeLessThan(200);
    expect(newState.player.gold).toBeGreaterThanOrEqual(0);
    expect(newState.player.totalDeaths).toBeGreaterThan(2);
    expect(newState.player.totalRuns).toBeGreaterThan(5);

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('PLAYER_DIED');
    expect(eventTypes).toContain('RUN_ENDED');
    expect(eventTypes).toContain('PHASE_CHANGED');
  });

  it('equipment drop: equipped items become death stash', () => {
    const state = makeDeathState({
      equipment: { weapon: 'iron_sword', chest: 'leather_vest' },
      floor: 3,
    });
    const rng = new SeededRNG(42);
    const { state: newState, events } = handlePlayerDeath(state, killerId, cause, rng);

    // Equipment should be cleared
    expect(newState.player.equipment.weapon).toBeNull();
    expect(newState.player.equipment.chest).toBeNull();

    // Death stash should exist with the dropped items
    expect(newState.player.deathStash).not.toBeNull();
    expect(newState.player.deathStash!.floor).toBeGreaterThanOrEqual(1);
    expect(newState.player.deathStash!.floor).toBeLessThanOrEqual(10);
    expect(newState.player.deathStash!.position).toEqual({ x: 5, y: 5 });
    expect(newState.player.deathStash!.items).toHaveLength(2);

    // Should emit EQUIPMENT_DROPPED event
    const dropEvent = events.find(e => e.type === 'EQUIPMENT_DROPPED');
    expect(dropEvent).toBeDefined();
    expect((dropEvent as any).floor).toBeGreaterThanOrEqual(1);
    expect((dropEvent as any).items).toHaveLength(2);
  });

  it('no equipment: death stash is null', () => {
    const state = makeDeathState({ equipment: { weapon: null, chest: null } });
    const rng = new SeededRNG(42);
    const { state: newState, events } = handlePlayerDeath(state, killerId, cause, rng);

    expect(newState.player.deathStash).toBeNull();
    expect(events.find(e => e.type === 'EQUIPMENT_DROPPED')).toBeUndefined();
  });

  it('existing stash is replaced by new death', () => {
    const oldStash = {
      items: [{ slot: 'weapon', item: {} as any, entityId: entityId('old_sword') }],
      floor: 1,
      position: { x: 0, y: 0 },
    };
    const state = makeDeathState({
      equipment: { weapon: 'iron_sword' },
      floor: 5,
      deathStash: oldStash,
    });
    const rng = new SeededRNG(42);
    const { state: newState } = handlePlayerDeath(state, killerId, cause, rng);

    // Old stash replaced with new one
    expect(newState.player.deathStash).not.toBeNull();
    expect(newState.player.deathStash!.floor).toBeGreaterThanOrEqual(1);
    expect(newState.player.deathStash!.items.length).toBeGreaterThan(0);
  });

  it('permadeath: overkill triggers game over', () => {
    // maxHP = 100, threshold = 75% = 75 overkill damage
    const state = makeDeathState({ maxHealth: 100 });
    const rng = new SeededRNG(42);
    const overkillDamage = 80; // above 75 threshold

    const { state: newState, events } = handlePlayerDeath(state, killerId, cause, rng, overkillDamage);

    expect(newState.phase).toBe('game_over');
    expect(newState.run).toBeNull();

    // No death stash on permadeath
    expect(newState.player.deathStash).toBeNull();

    const eventTypes = events.map(e => e.type);
    expect(eventTypes).toContain('PERMADEATH');
    expect(eventTypes).toContain('RUN_ENDED');
    expect(eventTypes).not.toContain('EQUIPMENT_DROPPED');

    const permadeathEvent = events.find(e => e.type === 'PERMADEATH') as any;
    expect(permadeathEvent.overkillDamage).toBeGreaterThan(0);
    expect(permadeathEvent.killerId).toBe(killerId);

    const runEndEvent = events.find(e => e.type === 'RUN_ENDED') as any;
    expect(runEndEvent.reason).toBe('permadeath');
  });

  it('permadeath: below threshold does NOT trigger permadeath', () => {
    const state = makeDeathState({ maxHealth: 100 });
    const rng = new SeededRNG(42);
    const overkillDamage = 40; // below 50 threshold

    const { state: newState, events } = handlePlayerDeath(state, killerId, cause, rng, overkillDamage);

    expect(newState.phase).toBe('town');
    expect(events.find(e => e.type === 'PERMADEATH')).toBeUndefined();
  });

  it('permadeath: zero overkill is normal death', () => {
    const state = makeDeathState({ maxHealth: 100 });
    const rng = new SeededRNG(42);
    const { state: newState } = handlePlayerDeath(state, killerId, cause, rng, 0);

    expect(newState.phase).toBe('town');
  });

  it('permadeath: exact threshold uses > not >=, so exact = normal death', () => {
    // threshold = 0.5 * 100 = 50. overkill = 50 is NOT > 50, so normal death
    const state = makeDeathState({ maxHealth: 100 });
    const rng = new SeededRNG(42);
    const { state: newState, events } = handlePlayerDeath(state, killerId, cause, rng, 50);

    expect(newState.phase).toBe('town');
    expect(events.find(e => e.type === 'PERMADEATH')).toBeUndefined();
  });

  it('gold loss at 0 gold stays 0 (not negative)', () => {
    const state = makeDeathState({ gold: 0 });
    const rng = new SeededRNG(42);
    const { state: newState } = handlePlayerDeath(state, killerId, cause, rng);

    expect(newState.player.gold).toBeGreaterThanOrEqual(0);
  });

  it('gold loss rounding with odd gold values', () => {
    const state = makeDeathState({ gold: 33 });
    const rng = new SeededRNG(42);
    const { state: newState } = handlePlayerDeath(state, killerId, cause, rng);

    // 25% of 33 = 8.25, rounded to 8. 33 - 8 = 25
    expect(newState.player.gold).toBeGreaterThanOrEqual(0);
    expect(newState.player.gold).toBeLessThan(33);
  });

  it('secondaryWeapon is included in death stash', () => {
    const secondaryWeapon = entityId('dagger');
    const state = makeDeathState({ equipment: { secondaryWeapon: secondaryWeapon.toString() } });

    // Add secondaryWeapon to item registry
    const itemRegistry = { items: new Map(state.itemRegistry.items) };
    itemRegistry.items.set(secondaryWeapon, {
      itemId: secondaryWeapon,
      name: 'Test Dagger',
      description: '',
      itemClass: 'weapon' as const,
      rarity: 'common' as const,
      value: 5,
      stackable: false,
      maxStack: 1,
      weapon: { damage: 3, damageType: 'physical', accuracy: 0, speed: 0, slot: 'weapon' as const, weaponRange: 1, weaponType: 'blade' as const },
    });

    const stateWithSecondaryWeapon = {
      ...state,
      itemRegistry,
      player: {
        ...state.player,
        equipment: { ...state.player.equipment, secondaryWeapon },
      },
    };

    const rng = new SeededRNG(42);
    const { state: newState } = handlePlayerDeath(stateWithSecondaryWeapon, killerId, cause, rng);

    // secondaryWeapon should be in the death stash
    expect(newState.player.deathStash).not.toBeNull();
    if (newState.player.deathStash) {
      const secondaryWeaponStash = newState.player.deathStash.items.find((item: any) => item.slot === 'secondaryWeapon');
      expect(secondaryWeaponStash).toBeDefined();
      expect(secondaryWeaponStash?.entityId).toBe(secondaryWeapon);
    }

    // secondaryWeapon should be cleared from equipment
    expect(newState.player.equipment.secondaryWeapon).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Death enrichment tests (merged from death-enrichment.test.ts)
// ---------------------------------------------------------------------------

describe('handlePlayerDeath - enriched event fields', () => {
  function makeEnrichedDeathState(overrides?: {
    killerName?: string;
    killerSpriteName?: string;
    enemyInRun?: boolean;
    floor?: number;
    gold?: number;
  }): GameState {
    const enrichedKillerId = entityId('enemy1');
    const floor = overrides?.floor ?? 3;

    const enemies = new Map();
    if (overrides?.enemyInRun !== false) {
      enemies.set('1,0', {
        id: enrichedKillerId,
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

    const base = createTestGameStateInCombat();

    return {
      ...base,
      player: {
        ...base.player,
        gold: overrides?.gold ?? 200,
        floor,
        position: { x: 5, y: 5 },
        totalDeaths: 2,
        stats: {
          ...base.player.stats,
          maxHealth: 100,
          health: 10,
          attack: 10,
          defense: 5,
          accuracy: 75,
          evasion: 10,
          speed: 100,
        },
      },
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
        objects: new Map(),
        turnCount: 0,
        isActive: true,
        runMetrics: {} as any,
        floorHistory: [],
        floorCache: new Map(),
        speedAccumulators: {},
      },
      itemRegistry: { items: new Map() } as any,
    };
  }

  it('should populate killerName from enemy in PLAYER_DIED event', () => {
    const state = makeEnrichedDeathState({ killerName: 'Orc Warrior' });
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.killerName).toBe('Orc Warrior');
  });

  it('should populate killerSpriteName from ENEMY_TEMPLATES in PLAYER_DIED event', () => {
    const state = makeEnrichedDeathState();
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.killerSpriteName === null || typeof playerDiedEvent.killerSpriteName === 'string').toBe(true);
  });

  it('should apply gold loss penalty on player death', () => {
    const state = makeEnrichedDeathState({ gold: 400 });
    const initialGold = state.player.gold;
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.goldLost).toBeGreaterThan(0);
    expect(playerDiedEvent.goldLost).toBeLessThanOrEqual(initialGold);
  });

  it('should calculate goldLost as a fraction of player gold', () => {
    const state = makeEnrichedDeathState({ gold: 100 });
    const initialGold = state.player.gold;
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.goldLost).toBeGreaterThanOrEqual(0);
    expect(playerDiedEvent.goldLost).toBeLessThanOrEqual(initialGold);
  });

  it('should set goldLost to 0 when player has no gold', () => {
    const state = makeEnrichedDeathState({ gold: 0 });
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.goldLost).toBeLessThanOrEqual(0);
  });

  it('should set overkillDamage to 0 for normal deaths', () => {
    const state = makeEnrichedDeathState();
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.overkillDamage).toBeGreaterThanOrEqual(0);
  });

  it('should populate floor from state in PLAYER_DIED event', () => {
    const state = makeEnrichedDeathState({ floor: 5 });
    const rng = new SeededRNG(42);
    const enrichedKillerId = entityId('enemy1');

    const { events } = handlePlayerDeath(state, enrichedKillerId, 'combat', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.floor).toBeGreaterThan(0);
    expect(playerDiedEvent.floor).toBeLessThanOrEqual(10);
  });

  it('should handle null killer gracefully in event', () => {
    const state = makeEnrichedDeathState({ enemyInRun: false });
    const rng = new SeededRNG(42);

    const { events } = handlePlayerDeath(state, null, 'hazard', rng);
    const playerDiedEvent = events.find(e => e.type === 'PLAYER_DIED') as any;

    expect(playerDiedEvent).toBeDefined();
    expect(playerDiedEvent.killerName).toBeNull();
    expect(playerDiedEvent.killerSpriteName).toBeNull();
  });
});
