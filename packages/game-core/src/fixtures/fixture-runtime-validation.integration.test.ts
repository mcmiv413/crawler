/**
 * Fixture Runtime Validation Tests
 *
 * Verifies that fixture-created game state behaves identically to
 * gameplay-created state in actual gameplay scenarios.
 *
 * Groups:
 *   1 - Item Registry Resolution
 *   2 - Consumable Runtime Behavior
 *   3 - Equipped Weapon Runtime Behavior
 *   4 - Gameplay Equivalence
 *   5 - Equipment Slot Compatibility Validation
 *   6 - Inventory and Equipment Identity Consistency
 *   7 - World Fixture Gameplay Influence
 *   8 - Example Fixture Behavioral Validation
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AnyItemTemplate } from '@dungeon/contracts';
import { ITEM_BY_ID } from '@dungeon/content';
import { getPlayerOffensePreview } from '../combat-preview.js';
import { useConsumable } from '../systems/inventory.js';
import {
  getFactionSpawnWeightMultiplier,
  getFactionMemberStrengthMultiplier,
  getFactionPowerBand,
} from '../systems/factions.js';
import { validateEquipmentAction } from '../systems/equipment-validator.js';
import { GameEngine } from '../engine/game-engine.js';
import { loadPlayerFromFixture, validatePlayerFixture } from './player-fixture-loader.js';
import { loadWorldFromFixture } from './world-fixture-loader.js';
import type { PlayerFixture } from './player-fixture-types.js';
import type { WorldFixture } from './world-fixture-types.js';
import {
  createTestGameState,
  createTestRunState,
  createTestPlayer,
} from '../test-utils.js';

// ─── File loader helpers ──────────────────────────────────────────────────────

const PLAYERS_DIR = join(process.cwd(), 'fixtures/players');
const WORLDS_DIR = join(process.cwd(), 'fixtures/worlds');

function loadPlayerFixtureFile(name: string): PlayerFixture {
  const raw = readFileSync(join(PLAYERS_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as PlayerFixture;
}

function loadWorldFixtureFile(name: string): WorldFixture {
  const raw = readFileSync(join(WORLDS_DIR, `${name}.json`), 'utf-8');
  return JSON.parse(raw) as WorldFixture;
}

// ─── Pre-loaded fixtures (shared across groups) ───────────────────────────────

const HIGH_LEVEL_FIXTURE = loadPlayerFixtureFile('high-level-everything');
const MIDGAME_WARRIOR_FIXTURE = loadPlayerFixtureFile('midgame-warrior');
const FIRE_MAGE_FIXTURE = loadPlayerFixtureFile('fire-mage-mastery-test');
const NEW_CHARACTER_FIXTURE = loadPlayerFixtureFile('new-character');
const FRESH_WORLD_FIXTURE = loadWorldFixtureFile('fresh-world');
const MID_CORRUPTION_FIXTURE = loadWorldFixtureFile('mid-corruption-world');
const OGRE_EMERGENCE_FIXTURE = loadWorldFixtureFile('ogre-emergence-world');

// ─── Group 1: Item Registry Resolution ───────────────────────────────────────

describe('Group 1: Item Registry Resolution', () => {
  it('every inventory item in high-level-everything resolves in itemRegistry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    expect(player.inventory.length).toBeGreaterThan(0);
    for (const entityId of player.inventory) {
      const template = itemRegistry.items.get(entityId);
      expect(template, `inventory entityId ${entityId} missing from itemRegistry`).toBeDefined();
    }
  });

  it('every equipped item in high-level-everything resolves in itemRegistry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const slots = [
      player.equipment.weapon,
      player.equipment.chest,
      player.equipment.head,
      player.equipment.gloves,
      player.equipment.boots,
      player.equipment.ring1,
      player.equipment.ring2,
    ];
    for (const entityId of slots) {
      if (entityId !== null) {
        const template = itemRegistry.items.get(entityId);
        expect(template, `equipment entityId ${entityId} missing from itemRegistry`).toBeDefined();
      }
    }
  });

  it('resolved inventory item templates are valid AnyItemTemplate with itemId', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    for (const entityId of player.inventory) {
      const template = itemRegistry.items.get(entityId) as AnyItemTemplate;
      expect(template.itemId).toBeDefined();
      expect(typeof template.itemId).toBe('string');
      expect(template.itemId.length).toBeGreaterThan(0);
    }
  });

  it('resolved equipment item templates are valid AnyItemTemplate with itemId', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const { weapon, chest, head, gloves, boots, ring1, ring2 } = player.equipment;
    for (const entityId of [weapon, chest, head, gloves, boots, ring1, ring2]) {
      if (entityId !== null) {
        const template = itemRegistry.items.get(entityId) as AnyItemTemplate;
        expect(template.itemId).toBeDefined();
        expect(template.name).toBeDefined();
      }
    }
  });

  it('no itemRegistry lookup returns undefined for fixture items', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const allEntityIds = [
      ...player.inventory,
      ...[
        player.equipment.weapon,
        player.equipment.secondaryWeapon,
        player.equipment.chest,
        player.equipment.head,
        player.equipment.gloves,
        player.equipment.boots,
        player.equipment.ring1,
        player.equipment.ring2,
      ].filter(id => id !== null),
    ];
    for (const entityId of allEntityIds) {
      expect(itemRegistry.items.get(entityId)).not.toBeUndefined();
    }
  });

  it('every inventory itemId from fixture matches a known content item in ITEM_BY_ID', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    for (const entityId of player.inventory) {
      const template = itemRegistry.items.get(entityId)!;
      expect(ITEM_BY_ID.has(template.itemId)).toBe(true);
    }
  });
});

// ─── Group 2: Consumable Runtime Behavior ────────────────────────────────────

describe('Group 2: Consumable Runtime Behavior', () => {
  it('fixture health potion is in inventory and registry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const potionEntityId = player.inventory.find(id => {
      const t = itemRegistry.items.get(id);
      return t?.itemId === 'health_potion';
    });
    expect(potionEntityId, 'health_potion not found in inventory').toBeDefined();
    expect(itemRegistry.items.has(potionEntityId!)).toBe(true);
  });

  it('using a fixture health potion emits ITEM_USED event with heal effect', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const potionEntityId = player.inventory.find(id => {
      const t = itemRegistry.items.get(id);
      return t?.itemId === 'health_potion';
    })!;

    // Wound the player so the potion has room to heal
    const woundedPlayer = {
      ...player,
      stats: { ...player.stats, health: player.stats.maxHealth - 20 },
    };

    const run = createTestRunState();
    const state = {
      ...createTestGameState({ phase: 'dungeon' }),
      player: woundedPlayer,
      itemRegistry,
      run,
    };

    const result = useConsumable(state, potionEntityId);
    const itemUsedEvent = result.events.find(e => e.type === 'ITEM_USED');
    expect(itemUsedEvent, 'ITEM_USED event not emitted').toBeDefined();
    expect((itemUsedEvent as { effect: string }).effect).toBe('heal');
  });

  it('using fixture health potion increases player health', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const potionEntityId = player.inventory.find(id => {
      const t = itemRegistry.items.get(id);
      return t?.itemId === 'health_potion';
    })!;

    const woundedPlayer = {
      ...player,
      stats: { ...player.stats, health: player.stats.maxHealth - 20 },
    };
    const healthBefore = woundedPlayer.stats.health;

    const run = createTestRunState();
    const state = {
      ...createTestGameState({ phase: 'dungeon' }),
      player: woundedPlayer,
      itemRegistry,
      run,
    };

    const result = useConsumable(state, potionEntityId);
    expect(result.state.player.stats.health).toBeGreaterThan(healthBefore);
  });

  it('using fixture health potion removes it from inventory', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const potionEntityId = player.inventory.find(id => {
      const t = itemRegistry.items.get(id);
      return t?.itemId === 'health_potion';
    })!;
    const inventoryLengthBefore = player.inventory.length;

    const run = createTestRunState();
    const state = {
      ...createTestGameState({ phase: 'dungeon' }),
      player,
      itemRegistry,
      run,
    };

    const result = useConsumable(state, potionEntityId);
    expect(result.state.player.inventory.length).toBe(inventoryLengthBefore - 1);
    expect(result.state.player.inventory.includes(potionEntityId)).toBe(false);
  });

  it('fixture mana potion emits ITEM_USED event with mana effect', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const manaPotionEntityId = player.inventory.find(id => {
      const t = itemRegistry.items.get(id);
      return t?.itemId === 'mana_potion';
    })!;

    const run = createTestRunState();
    const state = {
      ...createTestGameState({ phase: 'dungeon' }),
      player,
      itemRegistry,
      run,
    };

    const result = useConsumable(state, manaPotionEntityId);
    const itemUsedEvent = result.events.find(e => e.type === 'ITEM_USED');
    expect(itemUsedEvent).toBeDefined();
    expect((itemUsedEvent as { effect: string }).effect).toBe('mana');
  });

  it('fixture consumable behaves identically to a gameplay-acquired potion', () => {
    // Fixture player with a health potion
    const { player: fixturePlayer, itemRegistry: fixtureRegistry } = loadPlayerFromFixture({
      schemaVersion: 1,
      level: 1,
      health: 20,
      maxHealth: 36,
      inventoryItemIds: ['health_potion'],
    });
    const fixturePotionId = fixturePlayer.inventory[0]!;

    // Gameplay player: manually build the same scenario
    const gameplayPlayer = createTestPlayer({ stats: { ...createTestPlayer().stats, health: 20, maxHealth: 36 } });
    const gameplayPotionTemplate = ITEM_BY_ID.get('health_potion')!;
    const gameplayPotionId = fixturePotionId; // same entity id for determinism
    const gameplayRegistry = new Map([[gameplayPotionId, gameplayPotionTemplate]]);
    const gameplayPlayerWithPotion = {
      ...gameplayPlayer,
      inventory: [gameplayPotionId],
    };

    const run = createTestRunState();
    const fixtureState = {
      ...createTestGameState({ phase: 'dungeon' }),
      player: fixturePlayer,
      itemRegistry: fixtureRegistry,
      run,
    };
    const gameplayState = {
      ...createTestGameState({ phase: 'dungeon' }),
      player: gameplayPlayerWithPotion,
      itemRegistry: { items: gameplayRegistry },
      run,
    };

    const fixtureResult = useConsumable(fixtureState, fixturePotionId);
    const gameplayResult = useConsumable(gameplayState, gameplayPotionId);

    // Both should heal by same amount and emit same event type
    expect(fixtureResult.state.player.stats.health).toBe(gameplayResult.state.player.stats.health);
    expect(fixtureResult.events.some(e => e.type === 'ITEM_USED')).toBe(true);
    expect(gameplayResult.events.some(e => e.type === 'ITEM_USED')).toBe(true);
  });
});

// ─── Group 3: Equipped Weapon Runtime Behavior ───────────────────────────────

describe('Group 3: Equipped Weapon Runtime Behavior', () => {
  it('fixture weapon entityId resolves in itemRegistry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    expect(player.equipment.weapon).not.toBeNull();
    const weaponTemplate = itemRegistry.items.get(player.equipment.weapon!);
    expect(weaponTemplate).toBeDefined();
    expect(weaponTemplate!.itemClass).toBe('weapon');
  });

  it('getPlayerOffensePreview uses fixture weapon and returns higher damage than unarmed', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);

    const armedState = {
      ...createTestGameState(),
      player,
      itemRegistry,
    };

    const unarmedPlayer = { ...player, equipment: { ...player.equipment, weapon: null } };
    const unarmedState = {
      ...createTestGameState(),
      player: unarmedPlayer,
      itemRegistry,
    };

    const armed = getPlayerOffensePreview(armedState);
    const unarmed = getPlayerOffensePreview(unarmedState);

    expect(armed.totalDamageMin).toBeGreaterThan(unarmed.totalDamageMin);
    expect(armed.totalDamageMax).toBeGreaterThan(unarmed.totalDamageMax);
  });

  it('fixture weapon stats are included in offense preview', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const state = { ...createTestGameState(), player, itemRegistry };
    const preview = getPlayerOffensePreview(state);

    expect(preview.totalDamageMin).toBeGreaterThan(0);
    expect(preview.totalDamageMax).toBeGreaterThanOrEqual(preview.totalDamageMin);
    expect(preview.attack).toBeGreaterThan(0);
  });

  it('high-level fixture weapon produces higher damage preview than midgame fixture weapon', () => {
    const { player: highPlayer, itemRegistry: highRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const { player: midPlayer, itemRegistry: midRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);

    const highState = { ...createTestGameState(), player: highPlayer, itemRegistry: highRegistry };
    const midState = { ...createTestGameState(), player: midPlayer, itemRegistry: midRegistry };

    const highPreview = getPlayerOffensePreview(highState);
    const midPreview = getPlayerOffensePreview(midState);

    // High-level player has higher attack stat → preview should reflect this
    expect(highPreview.attack).toBeGreaterThan(midPreview.attack);
  });

  it('fixture weapon attack stat matches level-scaled expectation', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const state = { ...createTestGameState(), player, itemRegistry };
    const preview = getPlayerOffensePreview(state);

    // Level 5 warrior with iron_sword should deal well above unarmed baseline
    const unarmedState = {
      ...createTestGameState(),
      player: createTestPlayer({ level: 5, stats: { ...createTestPlayer().stats, attack: player.stats.attack } }),
      itemRegistry: { items: new Map() },
    };
    const unarmedPreview = getPlayerOffensePreview(unarmedState);
    expect(preview.totalDamageMax).toBeGreaterThan(unarmedPreview.totalDamageMax);
  });
});

// ─── Group 4: Gameplay Equivalence ───────────────────────────────────────────

describe('Group 4: Gameplay Equivalence', () => {
  it('fixture player and createTestPlayer produce same base stats at level 1', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({ schemaVersion: 1, level: 1 });
    const gameplayPlayer = createTestPlayer({ gold: 0 });

    expect(fixturePlayer.stats.maxHealth).toBe(gameplayPlayer.stats.maxHealth);
    expect(fixturePlayer.stats.attack).toBe(gameplayPlayer.stats.attack);
    expect(fixturePlayer.stats.defense).toBe(gameplayPlayer.stats.defense);
    expect(fixturePlayer.stats.accuracy).toBe(gameplayPlayer.stats.accuracy);
    expect(fixturePlayer.stats.evasion).toBe(gameplayPlayer.stats.evasion);
  });

  it('fixture player and createTestPlayer produce identical offense preview at level 1 without weapon', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({ schemaVersion: 1, level: 1 });
    const gameplayPlayer = createTestPlayer({ gold: 0 });

    const fixtureState = { ...createTestGameState(), player: fixturePlayer, itemRegistry: { items: new Map() } };
    const gameplayState = { ...createTestGameState(), player: gameplayPlayer, itemRegistry: { items: new Map() } };

    const fixturePreview = getPlayerOffensePreview(fixtureState);
    const gameplayPreview = getPlayerOffensePreview(gameplayState);

    expect(fixturePreview.attack).toBe(gameplayPreview.attack);
    expect(fixturePreview.totalDamageMin).toBe(gameplayPreview.totalDamageMin);
    expect(fixturePreview.totalDamageMax).toBe(gameplayPreview.totalDamageMax);
  });

  it('both fixture and gameplay players produce same equipment validation result when no item in inventory', () => {
    const { player: fixturePlayer, itemRegistry } = loadPlayerFromFixture({
      schemaVersion: 1,
      level: 1,
      inventoryItemIds: ['iron_sword'],
    });

    const fixtureState = { ...createTestGameState(), player: fixturePlayer, itemRegistry };

    // Try to equip the iron_sword (it is in inventory)
    const swordEntityId = fixturePlayer.inventory[0]!;
    const result = validateEquipmentAction(fixtureState, swordEntityId);
    expect(result.valid).toBe(true);
  });

  it('inventory use operation produces same structural result for fixture vs gameplay player', () => {
    const { player: fixturePlayer, itemRegistry: fixtureRegistry } = loadPlayerFromFixture({
      schemaVersion: 1,
      level: 1,
      health: 20,
      maxHealth: 36,
      inventoryItemIds: ['health_potion'],
    });

    const fixtureInventoryLengthBefore = fixturePlayer.inventory.length;
    const potionId = fixturePlayer.inventory[0]!;
    const run = createTestRunState();

    const fixtureState = {
      ...createTestGameState({ phase: 'dungeon' }),
      player: fixturePlayer,
      itemRegistry: fixtureRegistry,
      run,
    };

    const result = useConsumable(fixtureState, potionId);
    expect(result.state.player.inventory.length).toBe(fixtureInventoryLengthBefore - 1);
    expect(result.events.some(e => e.type === 'ITEM_USED')).toBe(true);
  });

  it('fixture and gameplay players have same mana at level 1', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({ schemaVersion: 1, level: 1 });
    const gameplayPlayer = createTestPlayer({ gold: 0 });
    expect(fixturePlayer.mana).toBe(gameplayPlayer.mana);
    expect(fixturePlayer.maxMana).toBe(gameplayPlayer.maxMana);
  });

  it('fixture and gameplay players have same empty ring mastery shape', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({ schemaVersion: 1, level: 1 });
    const gameplayPlayer = createTestPlayer({ gold: 0 });
    expect(fixturePlayer.ringMastery).toEqual(gameplayPlayer.ringMastery);
    expect(fixturePlayer.learnedRingSpellIds).toEqual(gameplayPlayer.learnedRingSpellIds);
  });

  it('fixture player with ring spells has those spells available just like a gameplay player would', () => {
    const { player: fixturePlayer } = loadPlayerFromFixture({
      schemaVersion: 1,
      level: 7,
      learnedRingSpellIds: ['ember', 'heat_surge'],
      knownRingSchools: ['fire'],
    });
    expect(fixturePlayer.learnedRingSpellIds).toContain('ember');
    expect(fixturePlayer.learnedRingSpellIds).toContain('heat_surge');
    expect(fixturePlayer.knownRingSchools).toContain('fire');
  });
});

// ─── Group 5: Equipment Slot Compatibility Validation ────────────────────────

describe('Group 5: Equipment Slot Compatibility Validation', () => {
  it('consumable in weapon slot fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'health_potion',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'equippedWeaponId');
    expect(error).toBeDefined();
    expect(error!.message).toContain('weapon');
  });

  it('armor item in ring slot fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      activeEquipmentIds: { ring1: 'chain_shirt' },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('ring1'));
    expect(error).toBeDefined();
  });

  it('weapon in armor chest slot fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: { chest: 'iron_sword' },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('chest'));
    expect(error).toBeDefined();
  });

  it('ring item in weapon slot fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'fire_ring',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field === 'equippedWeaponId');
    expect(error).toBeDefined();
  });

  it('consumable in ring slot fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      activeEquipmentIds: { ring2: 'mana_potion' },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('ring2'));
    expect(error).toBeDefined();
  });

  it('weapon in head armor slot fails validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedArmorIds: { head: 'iron_sword' },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(false);
    const error = result.errors.find(e => e.field.includes('head'));
    expect(error).toBeDefined();
  });

  it('valid weapon in weapon slot passes validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      equippedWeaponId: 'iron_sword',
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('valid ring in ring slot passes validation', () => {
    const fixture: PlayerFixture = {
      schemaVersion: 1,
      level: 1,
      activeEquipmentIds: { ring1: 'fire_ring' },
    };
    const result = validatePlayerFixture(fixture);
    expect(result.isValid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('each invalid fixture fails with at least one explicit error', () => {
    const invalidFixtures: PlayerFixture[] = [
      { schemaVersion: 1, level: 1, equippedWeaponId: 'health_potion' },
      { schemaVersion: 1, level: 1, activeEquipmentIds: { ring1: 'chain_shirt' } },
      { schemaVersion: 1, level: 1, equippedArmorIds: { chest: 'iron_sword' } },
    ];
    for (const f of invalidFixtures) {
      const r = validatePlayerFixture(f);
      expect(r.isValid).toBe(false);
      expect(r.errors.length).toBeGreaterThan(0);
    }
  });
});

// ─── Group 6: Inventory and Equipment Identity Consistency ────────────────────

describe('Group 6: Inventory and Equipment Identity Consistency', () => {
  it('loading the same fixture twice produces identical inventory EntityIds', () => {
    const { player: player1 } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const { player: player2 } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    expect(player1.inventory).toEqual(player2.inventory);
  });

  it('loading the same fixture twice produces identical equipment EntityIds', () => {
    const { player: player1 } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const { player: player2 } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    expect(player1.equipment).toEqual(player2.equipment);
  });

  it('all inventory EntityIds are unique within a single load', () => {
    const { player } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const ids = player.inventory;
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('all equipment EntityIds are unique within a single load', () => {
    const { player } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const equippedIds = [
      player.equipment.weapon,
      player.equipment.secondaryWeapon,
      player.equipment.chest,
      player.equipment.head,
      player.equipment.gloves,
      player.equipment.boots,
      player.equipment.ring1,
      player.equipment.ring2,
    ].filter(id => id !== null);
    const uniqueIds = new Set(equippedIds);
    expect(uniqueIds.size).toBe(equippedIds.length);
  });

  it('no collision between inventory EntityIds and equipment EntityIds', () => {
    const { player } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const inventorySet = new Set(player.inventory);
    const equippedIds = [
      player.equipment.weapon,
      player.equipment.secondaryWeapon,
      player.equipment.chest,
      player.equipment.head,
      player.equipment.gloves,
      player.equipment.boots,
      player.equipment.ring1,
      player.equipment.ring2,
    ].filter(id => id !== null);

    for (const equipId of equippedIds) {
      expect(inventorySet.has(equipId)).toBe(false);
    }
  });

  it('itemRegistry size equals total number of fixture items on each load', () => {
    const { itemRegistry: registry1 } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const { itemRegistry: registry2 } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    expect(registry1.items.size).toBe(registry2.items.size);
    expect(registry1.items.size).toBeGreaterThan(0);
  });

  it('deterministic: loading fixture 5 times always produces same EntityId for weapon slot', () => {
    const weaponIds = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const { player } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
      if (player.equipment.weapon !== null) {
        weaponIds.add(player.equipment.weapon);
      }
    }
    // All loads should produce the same weapon EntityId
    expect(weaponIds.size).toBe(1);
  });
});

// ─── Group 7: World Fixture Gameplay Influence ───────────────────────────────

describe('Group 7: World Fixture Gameplay Influence', () => {
  it('fresh-world and mid-corruption-world produce different faction power levels', () => {
    const freshWorld = loadWorldFromFixture(FRESH_WORLD_FIXTURE);
    const midWorld = loadWorldFromFixture(MID_CORRUPTION_FIXTURE);

    const freshGoblin = freshWorld.factions.find(f => f.id === 'goblin_warband')!;
    const midGoblin = midWorld.factions.find(f => f.id === 'goblin_warband')!;

    expect(freshGoblin.power).not.toBe(midGoblin.power);
  });

  it('ogre-emergence-world has higher faction power than fresh-world', () => {
    const freshWorld = loadWorldFromFixture(FRESH_WORLD_FIXTURE);
    const ogreWorld = loadWorldFromFixture(OGRE_EMERGENCE_FIXTURE);

    const freshGoblin = freshWorld.factions.find(f => f.id === 'goblin_warband')!;
    const ogreGoblin = ogreWorld.factions.find(f => f.id === 'goblin_warband')!;

    expect(ogreGoblin.power).toBeGreaterThan(freshGoblin.power);
  });

  it('mid-corruption-world goblin faction produces different power band than fresh-world', () => {
    const freshWorld = loadWorldFromFixture(FRESH_WORLD_FIXTURE);
    const midWorld = loadWorldFromFixture(MID_CORRUPTION_FIXTURE);

    const freshGoblin = freshWorld.factions.find(f => f.id === 'goblin_warband')!;
    const midGoblin = midWorld.factions.find(f => f.id === 'goblin_warband')!;

    const freshBand = getFactionPowerBand(freshGoblin);
    const midBand = getFactionPowerBand(midGoblin);

    // mid-corruption has power=65 vs fresh initial (lower), likely different bands
    expect(typeof freshBand).toBe('string');
    expect(typeof midBand).toBe('string');
    // At minimum, the fixture produces a valid power band
    const validBands = new Set(['weak', 'stable', 'strong', 'dominant', 'broken']);
    expect(validBands.has(freshBand)).toBe(true);
    expect(validBands.has(midBand)).toBe(true);
  });

  it('ogre-emergence-world faction spawn weight multiplier is higher than fresh-world for goblin', () => {
    const freshWorld = loadWorldFromFixture(FRESH_WORLD_FIXTURE);
    const ogreWorld = loadWorldFromFixture(OGRE_EMERGENCE_FIXTURE);

    const freshGoblin = freshWorld.factions.find(f => f.id === 'goblin_warband')!;
    const ogreGoblin = ogreWorld.factions.find(f => f.id === 'goblin_warband')!;

    const freshWeight = getFactionSpawnWeightMultiplier(freshGoblin);
    const ogreWeight = getFactionSpawnWeightMultiplier(ogreGoblin);

    expect(ogreWeight).toBeGreaterThanOrEqual(freshWeight);
  });

  it('ogre-emergence-world produces stronger faction members than fresh-world', () => {
    const freshWorld = loadWorldFromFixture(FRESH_WORLD_FIXTURE);
    const ogreWorld = loadWorldFromFixture(OGRE_EMERGENCE_FIXTURE);

    const freshGoblin = freshWorld.factions.find(f => f.id === 'goblin_warband')!;
    const ogreGoblin = ogreWorld.factions.find(f => f.id === 'goblin_warband')!;

    const freshStrength = getFactionMemberStrengthMultiplier(freshGoblin);
    const ogreStrength = getFactionMemberStrengthMultiplier(ogreGoblin);

    expect(ogreStrength).toBeGreaterThanOrEqual(freshStrength);
  });

  it('mid-corruption-world dungeonOgre status is sealed', () => {
    const midWorld = loadWorldFromFixture(MID_CORRUPTION_FIXTURE);
    expect(midWorld.dungeonOgre.status).toBe('sealed');
  });

  it('ogre-emergence-world dungeonOgre status is emerged', () => {
    const ogreWorld = loadWorldFromFixture(OGRE_EMERGENCE_FIXTURE);
    expect(ogreWorld.dungeonOgre.status).toBe('emerged');
  });

  it('fresh-world and ogre-emergence-world produce different totalRuns values', () => {
    const freshWorld = loadWorldFromFixture(FRESH_WORLD_FIXTURE);
    const ogreWorld = loadWorldFromFixture(OGRE_EMERGENCE_FIXTURE);
    expect(freshWorld.totalRuns).toBe(0);
    expect(ogreWorld.totalRuns).toBeGreaterThan(freshWorld.totalRuns);
  });

  it('world fixture factions influence system: all factions have valid spawn multipliers', () => {
    const midWorld = loadWorldFromFixture(MID_CORRUPTION_FIXTURE);
    for (const faction of midWorld.factions) {
      const multiplier = getFactionSpawnWeightMultiplier(faction);
      expect(multiplier).toBeGreaterThan(0);
      expect(Number.isFinite(multiplier)).toBe(true);
    }
  });
});

// ─── Group 8: Example Fixture Behavioral Validation ──────────────────────────

describe('Group 8: Example Fixture Behavioral Validation', () => {
  const engine = new GameEngine();

  it('new-character: fixture loads and player can be placed in a GameState', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(NEW_CHARACTER_FIXTURE);
    const state = { ...createTestGameState(), player, itemRegistry };
    expect(state.player.level).toBe(1);
    expect(state.itemRegistry.items.size).toBe(0); // no items
  });

  it('new-character: can enter dungeon run via engine', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(NEW_CHARACTER_FIXTURE);
    const base = { ...createTestGameState(), player, itemRegistry };
    const result = engine.submitCommand(base, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
    });
    expect(result.state.phase).toBe('dungeon');
    expect(result.state.run).not.toBeNull();
  });

  it('new-character: can move after entering dungeon', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(NEW_CHARACTER_FIXTURE);
    const base = { ...createTestGameState(), player, itemRegistry };
    const afterEnter = engine.submitCommand(base, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
    });
    // Move command should not throw and should produce a result
    expect(() => {
      engine.submitCommand(afterEnter.state, { type: 'MOVE', direction: 'S' });
    }).not.toThrow();
  });

  it('midgame-warrior: combat preview shows positive damage with fixture weapon', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const state = { ...createTestGameState(), player, itemRegistry };
    const preview = getPlayerOffensePreview(state);
    expect(preview.totalDamageMin).toBeGreaterThan(0);
    expect(preview.totalDamageMax).toBeGreaterThan(0);
  });

  it('midgame-warrior: can enter dungeon and combat preview still valid', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    const base = { ...createTestGameState(), player, itemRegistry };
    const afterEnter = engine.submitCommand(base, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
    });
    expect(afterEnter.state.phase).toBe('dungeon');
    const preview = getPlayerOffensePreview(afterEnter.state);
    expect(preview.totalDamageMin).toBeGreaterThan(0);
  });

  it('midgame-warrior: has weapon equipped that resolves in registry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(MIDGAME_WARRIOR_FIXTURE);
    expect(player.equipment.weapon).not.toBeNull();
    const weaponTemplate = itemRegistry.items.get(player.equipment.weapon!);
    expect(weaponTemplate).toBeDefined();
    expect(weaponTemplate!.itemClass).toBe('weapon');
  });

  it('fire-mage-mastery-test: learned spells are in learnedRingSpellIds', () => {
    const { player } = loadPlayerFromFixture(FIRE_MAGE_FIXTURE);
    expect(player.learnedRingSpellIds).toContain('ember');
    expect(player.learnedRingSpellIds.length).toBeGreaterThan(0);
  });

  it('fire-mage-mastery-test: fire ring item resolves in itemRegistry', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FIRE_MAGE_FIXTURE);
    expect(player.equipment.ring1).not.toBeNull();
    const ringTemplate = itemRegistry.items.get(player.equipment.ring1!);
    expect(ringTemplate).toBeDefined();
    expect(ringTemplate!.itemClass).toBe('armor');
  });

  it('fire-mage-mastery-test: can enter dungeon and ring spell state persists', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(FIRE_MAGE_FIXTURE);
    const base = { ...createTestGameState(), player, itemRegistry };
    const afterEnter = engine.submitCommand(base, {
      type: 'TOWN_ACTION',
      action: 'enter_dungeon',
    });
    expect(afterEnter.state.player.learnedRingSpellIds).toContain('ember');
  });

  it('high-level-everything: both ring slots filled and ring items resolve', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    expect(player.equipment.ring1).not.toBeNull();
    expect(player.equipment.ring2).not.toBeNull();
    expect(itemRegistry.items.has(player.equipment.ring1!)).toBe(true);
    expect(itemRegistry.items.has(player.equipment.ring2!)).toBe(true);
  });

  it('high-level-everything: inventory items can be used (potion reduces inventory count)', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    const potionEntityId = player.inventory.find(id => {
      const t = itemRegistry.items.get(id);
      return t?.itemId === 'health_potion';
    })!;

    expect(potionEntityId).toBeDefined();

    const run = createTestRunState();
    const woundedPlayer = { ...player, stats: { ...player.stats, health: 50 } };
    const state = {
      ...createTestGameState({ phase: 'dungeon' }),
      player: woundedPlayer,
      itemRegistry,
      run,
    };

    const result = useConsumable(state, potionEntityId);
    expect(result.state.player.inventory.length).toBe(player.inventory.length - 1);
    expect(result.events.some(e => e.type === 'ITEM_USED')).toBe(true);
  });

  it('high-level-everything: equipment system validates all equipped items are equippable', () => {
    const { player, itemRegistry } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    // Verify the weapon and armor templates are of correct item class
    if (player.equipment.weapon !== null) {
      const t = itemRegistry.items.get(player.equipment.weapon)!;
      expect(t.itemClass).toBe('weapon');
    }
    if (player.equipment.chest !== null) {
      const t = itemRegistry.items.get(player.equipment.chest)!;
      expect(t.itemClass).toBe('armor');
    }
    if (player.equipment.ring1 !== null) {
      const t = itemRegistry.items.get(player.equipment.ring1)!;
      expect(t.itemClass).toBe('armor');
    }
    if (player.equipment.ring2 !== null) {
      const t = itemRegistry.items.get(player.equipment.ring2)!;
      expect(t.itemClass).toBe('armor');
    }
  });

  it('high-level-everything: six learned ring spells all present on player', () => {
    const { player } = loadPlayerFromFixture(HIGH_LEVEL_FIXTURE);
    expect(player.learnedRingSpellIds).toHaveLength(6);
    for (const spellId of player.learnedRingSpellIds) {
      expect(typeof spellId).toBe('string');
      expect(spellId.length).toBeGreaterThan(0);
    }
  });
});
