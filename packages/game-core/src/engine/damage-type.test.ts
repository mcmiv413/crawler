import { describe, it, expect } from 'vitest';
import { GameEngine } from './game-engine.js';
import { entityId } from '@dungeon/contracts';
import type { GameState, EnemyInstance, DomainEvent } from '@dungeon/contracts';
import { WEAPONS } from '@dungeon/content';

/** Enter dungeon from a fresh game using a fixed seed for reproducibility. */
function enterDungeon(engine: GameEngine, seed = 42): GameState {
  const state = engine.createNewGame(seed);
  return engine.submitCommand(state, { type: 'TOWN_ACTION', action: 'enter_dungeon' }).state;
}

/** Build a minimal enemy instance at the given position with optional affinities. */
function makeEnemy(
  id: string,
  x: number,
  y: number,
  affinities: Partial<Record<string, number>> = {},
): EnemyInstance {
  return {
    id: entityId(id),
    templateId: 'goblin_skirmisher',
    name: 'Goblin',
    archetype: 'skittish_ranged',
    tier: 2,
    stats: { maxHealth: 500, health: 500, attack: 5, defense: 0, accuracy: 70, evasion: 0, speed: 100 },
    equipment: {
      weapon: {
        damageMultiplier: 1.0,
        damageType: 'physical',
        range: 1,
      },
    },
    affinities,
    spawn: {
      floorRange: [1, 3],
      weight: 1,
    },
    lootTableId: 'goblin',
    experienceValue: 10,
    description: 'A sneaky goblin scout.',
    ascii: 'g',
    position: { x, y },
    statuses: [],
    isAlerted: true,
    lastKnownPlayerPos: null,
  };
}

/** Extract ATTACK_PERFORMED events from a result's events. */
function getAttackEvents(events: readonly DomainEvent[]) {
  return events.filter((e): e is Extract<DomainEvent, { type: 'ATTACK_PERFORMED' }> =>
    e.type === 'ATTACK_PERFORMED',
  );
}

// ---------------------------------------------------------------------------
// Damage Type Correctness
// ---------------------------------------------------------------------------

describe('Combat damage type correctness', () => {
  it('fire weapon attack reports fire damageType in ATTACK_PERFORMED event', () => {
    const engine = new GameEngine();
    const dungeonState = enterDungeon(engine);

    const flameDagger = WEAPONS.find(w => w.itemId === 'flame_dagger')!;
    const weaponId = entityId('fire_wpn_1');
    const enemy = makeEnemy('e1', 5, 6);

    const newRegistry = new Map(dungeonState.itemRegistry.items);
    newRegistry.set(weaponId, flameDagger);

    const patchedState: GameState = {
      ...dungeonState,
      player: {
        ...dungeonState.player,
        position: { x: 5, y: 5 },
        stats: { ...dungeonState.player.stats, attack: 100, accuracy: 200 },
        equipment: { ...dungeonState.player.equipment, weapon: weaponId },
        inventory: [...dungeonState.player.inventory, weaponId],
      },
      run: {
        ...dungeonState.run!,
        enemies: new Map([['5,6', enemy]]),
      },
      itemRegistry: { items: newRegistry },
    };

    const result = engine.submitCommand(patchedState, { type: 'ATTACK', targetId: enemy.id });
    const attacks = getAttackEvents(result.events);

    expect(attacks.length).toBeGreaterThanOrEqual(1);
    // The player's attack event should use fire, not physical
    const playerAttack = attacks.find(e => e.attackerId === patchedState.player.id);
    expect(playerAttack).toBeDefined();
    expect(playerAttack!.damageType).toBe('fire');
  });

  it('fire weapon vs fire-resistant enemy deals reduced damage', () => {
    const engine = new GameEngine();
    const dungeonState = enterDungeon(engine);

    const flameDagger = WEAPONS.find(w => w.itemId === 'flame_dagger')!;
    const weaponId = entityId('fire_wpn_2');

    // Enemy with 80% fire resistance
    const resistantEnemy = makeEnemy('e2', 5, 6, { fire: 0.8 });
    // Enemy with no fire resistance
    const normalEnemy = makeEnemy('e3', 5, 6);

    const newRegistry = new Map(dungeonState.itemRegistry.items);
    newRegistry.set(weaponId, flameDagger);

    const baseState: GameState = {
      ...dungeonState,
      player: {
        ...dungeonState.player,
        position: { x: 5, y: 5 },
        stats: { ...dungeonState.player.stats, attack: 100, accuracy: 200 },
        equipment: { ...dungeonState.player.equipment, weapon: weaponId },
        inventory: [...dungeonState.player.inventory, weaponId],
      },
      itemRegistry: { items: newRegistry },
    };

    // Attack resistant enemy
    const stateVsResistant: GameState = {
      ...baseState,
      run: { ...dungeonState.run!, enemies: new Map([['5,6', resistantEnemy]]) },
    };
    const resultResistant = engine.submitCommand(stateVsResistant, { type: 'ATTACK', targetId: resistantEnemy.id });
    const attackResistant = getAttackEvents(resultResistant.events).find(e => e.attackerId === baseState.player.id);

    // Attack normal enemy (same seed/turn for comparable RNG)
    const stateVsNormal: GameState = {
      ...baseState,
      run: { ...dungeonState.run!, enemies: new Map([['5,6', normalEnemy]]) },
    };
    const resultNormal = engine.submitCommand(stateVsNormal, { type: 'ATTACK', targetId: normalEnemy.id });
    const attackNormal = getAttackEvents(resultNormal.events).find(e => e.attackerId === baseState.player.id);

    expect(attackResistant).toBeDefined();
    expect(attackNormal).toBeDefined();

    // Both should hit (accuracy 200 vs evasion 0)
    expect(attackResistant!.hit).toBe(true);
    expect(attackNormal!.hit).toBe(true);

    // The resistant enemy should take less damage
    expect(attackResistant!.damage).toBeLessThan(attackNormal!.damage);
  });

  it('unarmed attack uses physical damageType', () => {
    const engine = new GameEngine();
    const dungeonState = enterDungeon(engine);

    const enemy = makeEnemy('e4', 5, 6);

    const patchedState: GameState = {
      ...dungeonState,
      player: {
        ...dungeonState.player,
        position: { x: 5, y: 5 },
        stats: { ...dungeonState.player.stats, attack: 100, accuracy: 200 },
        equipment: { weapon: null, secondaryWeapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null },
      },
      run: {
        ...dungeonState.run!,
        enemies: new Map([['5,6', enemy]]),
      },
    };

    const result = engine.submitCommand(patchedState, { type: 'ATTACK', targetId: enemy.id });
    const attacks = getAttackEvents(result.events);

    const playerAttack = attacks.find(e => e.attackerId === patchedState.player.id);
    expect(playerAttack).toBeDefined();
    expect(playerAttack!.damageType).toBe('physical');
  });
});
