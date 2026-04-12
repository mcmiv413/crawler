import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateEquippedStats,
  equipItem,
  unequipItem,
  swapWeaponSets,
} from './equipment.js';
import { addItemToInventory } from './inventory.js';
import { entityId, EMPTY_WEAPON_MASTERY } from '@dungeon/contracts';
import type { Equipment } from '@dungeon/contracts';
import type { WeaponTemplate, ArmorTemplate, RunState } from '@dungeon/contracts';
import { BASE_TEST_STATS, createTestGameState } from '../test-utils.js';

const testWeapon: WeaponTemplate = {
  itemId: 'test_sword',
  name: 'Test Sword',
  description: 'A sword',
  itemClass: 'weapon',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 8, damageType: 'physical', accuracy: 5, speed: 3, slot: 'weapon', weaponRange: 1 },
};

const testArmor: ArmorTemplate = {
  itemId: 'test_vest',
  name: 'Test Vest',
  description: 'A vest',
  itemClass: 'armor',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  armor: { defense: 6, evasionPenalty: 2, slot: 'chest', enchantmentSlots: 0, enchantments: [] },
};

describe('calculateEquippedStats', () => {
  it('returns base stats when nothing is equipped', () => {
    const result = calculateEquippedStats(
      BASE_TEST_STATS,
      BASE_TEST_STATS.health,
      { weapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null, secondaryWeapon: null },
      new Map(),
    );
    expect(result.attack).toBe(BASE_TEST_STATS.attack);
    expect(result.defense).toBe(BASE_TEST_STATS.defense);
    expect(result.health).toBe(BASE_TEST_STATS.health);
  });

  it('adds weapon damage, accuracy, and speed bonuses', () => {
    const weaponId = entityId('w1');
    const registry = new Map([[weaponId, testWeapon]]);

    const result = calculateEquippedStats(
      BASE_TEST_STATS,
      BASE_TEST_STATS.health,
      { weapon: weaponId, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null, secondaryWeapon: null },
      registry,
    );

    expect(result.attack).toBe(BASE_TEST_STATS.attack + 8);
    expect(result.accuracy).toBe(BASE_TEST_STATS.accuracy + 5);
    expect(result.speed).toBe(BASE_TEST_STATS.speed + 3);
  });

  it('adds armor defense and applies evasion penalty', () => {
    const armorId = entityId('a1');
    const registry = new Map([[armorId, testArmor]]);

    const result = calculateEquippedStats(
      BASE_TEST_STATS,
      BASE_TEST_STATS.health,
      { weapon: null, chest: armorId, head: null, gloves: null, boots: null, ring1: null, ring2: null, secondaryWeapon: null },
      registry,
    );

    expect(result.defense).toBe(BASE_TEST_STATS.defense + 6);
    expect(result.evasion).toBe(BASE_TEST_STATS.evasion - 2);
  });

  it('preserves current health, not base health', () => {
    const result = calculateEquippedStats(
      BASE_TEST_STATS,
      55,
      { weapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null, secondaryWeapon: null },
      new Map(),
    );
    expect(result.health).toBe(55);
    expect(result.maxHealth).toBe(BASE_TEST_STATS.maxHealth);
  });
});

describe('equipItem stat recalculation', () => {
  it('increases attack when a weapon is equipped', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const itemId = s1.player.inventory[0]!;
    const baseAttack = s1.player.baseStats.attack;

    const { state: s2 } = equipItem(s1, itemId);

    expect(s2.player.stats.attack).toBe(baseAttack + 8);
    expect(s2.player.equipment.weapon).toBe(itemId);
  });

  it('increases defense when armor is equipped', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testArmor);
    const itemId = s1.player.inventory[0]!;
    const baseDefense = s1.player.baseStats.defense;

    const { state: s2 } = equipItem(s1, itemId);

    expect(s2.player.stats.defense).toBe(baseDefense + 6);
    expect(s2.player.equipment.chest).toBe(itemId);
  });

  it('preserves current health (does not reset to max) when equipping', () => {
    const lowHpState = createTestGameState({ player: { stats: { ...BASE_TEST_STATS, health: 40 } } });
    const { state: s1 } = addItemToInventory(lowHpState, testWeapon);
    const itemId = s1.player.inventory[0]!;

    const { state: s2 } = equipItem(s1, itemId);

    expect(s2.player.stats.health).toBe(40);
  });

  it('calculateEquippedStats with weapon=null after weapon equipped matches base stats', () => {
    // Equip a weapon, then recalculate with weapon=null — should revert to base
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const { state: withWeapon } = equipItem(s1, s1.player.inventory[0]!);

    // Now recalculate as if weapon slot is null (simulates unequip)
    const result = calculateEquippedStats(
      withWeapon.player.baseStats,
      withWeapon.player.stats.health,
      { weapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null, secondaryWeapon: null },
      new Map(),
    );

    expect(result.attack).toBe(withWeapon.player.baseStats.attack);
    expect(result.accuracy).toBe(withWeapon.player.baseStats.accuracy);
  });

  it('equipping second weapon fills secondary slot', () => {
    const heavyWeapon: WeaponTemplate = {
      ...testWeapon,
      itemId: 'heavy',
      weapon: { ...testWeapon.weapon, damage: 20 },
    };

    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const { state: s2 } = addItemToInventory(s1, heavyWeapon);
    const lightId = s2.player.inventory[0]!;
    const heavyId = s2.player.inventory[1]!;

    const { state: withLight } = equipItem(s2, lightId);
    const { state: withBoth } = equipItem(withLight, heavyId);

    // Light weapon in primary, heavy in secondary
    expect(withBoth.player.equipment.weapon).toBe(lightId);
    expect(withBoth.player.equipment.secondaryWeapon).toBe(heavyId);
    // Stats should be based on primary (light) weapon
    expect(withBoth.player.stats.attack).toBe(s2.player.baseStats.attack + 8);
  });
});

describe('unequipItem - Phase C2: unequip items from all slots', () => {
  it('unequips weapon and adds it back to inventory', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const itemId = s1.player.inventory[0]!;

    const { state: equipped } = equipItem(s1, itemId);
    expect(equipped.player.equipment.weapon).toBe(itemId);

    const { state: unequipped } = unequipItem(equipped, itemId);
    expect(unequipped.player.equipment.weapon).toBeNull();
    expect(unequipped.player.inventory).toContain(itemId);
  });

  it('unequips armor and adds it back to inventory', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testArmor);
    const itemId = s1.player.inventory[0]!;

    const { state: equipped } = equipItem(s1, itemId);
    expect(equipped.player.equipment.chest).toBe(itemId);

    const { state: unequipped } = unequipItem(equipped, itemId);
    expect(unequipped.player.equipment.chest).toBeNull();
    expect(unequipped.player.inventory).toContain(itemId);
  });

  it('unequipping recalculates stats correctly', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const itemId = s1.player.inventory[0]!;

    const { state: equipped } = equipItem(s1, itemId);
    const attackWithWeapon = equipped.player.stats.attack;
    expect(attackWithWeapon).toBeGreaterThan(state.player.baseStats.attack);

    const { state: unequipped } = unequipItem(equipped, itemId);
    expect(unequipped.player.stats.attack).toBe(unequipped.player.baseStats.attack);
  });

  it('unequipping from one ring slot does not affect the other', () => {
    const ring1: ArmorTemplate = {
      id: entityId('ring1'),
      itemId: 'ring1',
      name: 'Ring 1',
      itemClass: 'armor',
      description: 'A ring',
      rarity: 'common',
      value: 10,
      weight: 0.1,
      armor: { slot: 'ring', defense: 2, evasionPenalty: 0, enchantments: [], enchantmentSlots: 0 },
    };
    const ring2: ArmorTemplate = {
      id: entityId('ring2'),
      itemId: 'ring2',
      name: 'Ring 2',
      itemClass: 'armor',
      description: 'Another ring',
      rarity: 'common',
      value: 10,
      weight: 0.1,
      armor: { slot: 'ring', defense: 2, evasionPenalty: 0, enchantments: [], enchantmentSlots: 0 },
    };

    let state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, ring1);
    const { state: s2 } = addItemToInventory(s1, ring2);
    const ring1Id = s2.player.inventory[0]!;
    const ring2Id = s2.player.inventory[1]!;

    const { state: withRing1 } = equipItem(s2, ring1Id);
    const { state: withBothRings } = equipItem(withRing1, ring2Id);
    expect(withBothRings.player.equipment.ring1).toBe(ring1Id);
    expect(withBothRings.player.equipment.ring2).toBe(ring2Id);

    const { state: afterUnequip } = unequipItem(withBothRings, ring1Id);
    expect(afterUnequip.player.equipment.ring1).toBeNull();
    expect(afterUnequip.player.equipment.ring2).toBe(ring2Id);
  });

  it('returns empty result if item is not equipped', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const itemId = s1.player.inventory[0]!;

    const { state: result } = unequipItem(s1, itemId);
    // State should be unchanged if item was not equipped
    expect(result.player.equipment.weapon).toBeNull();
    expect(result.player.inventory).toContain(itemId);
  });
});

describe('swapWeaponSets - Phase C5: weapon swapping', () => {
  it('swaps primary and secondary weapons', () => {
    let state = createTestGameState();
    const heavyWeapon: WeaponTemplate = {
      ...testWeapon,
      itemId: 'heavy',
      name: 'Heavy Sword',
      weapon: { ...testWeapon.weapon, damage: 20 },
    };

    const { state: s1 } = addItemToInventory(state, testWeapon);
    const { state: s2 } = addItemToInventory(s1, heavyWeapon);
    const lightId = s2.player.inventory[0]!;
    const heavyId = s2.player.inventory[1]!;

    const { state: withLight } = equipItem(s2, lightId);
    expect(withLight.player.equipment.weapon).toBe(lightId);

    const { state: withBoth } = equipItem(withLight, heavyId);
    expect(withBoth.player.equipment.weapon).toBe(lightId);
    expect(withBoth.player.equipment.secondaryWeapon).toBe(heavyId);

    const { state: swapped } = swapWeaponSets(withBoth);
    expect(swapped.player.equipment.weapon).toBe(heavyId);
    expect(swapped.player.equipment.secondaryWeapon).toBe(lightId);
  });

  it('equips secondary weapon when primary is full', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const itemId = s1.player.inventory[0]!;

    const { state: withPrimary } = equipItem(s1, itemId);
    expect(withPrimary.player.equipment.weapon).toBe(itemId);
    expect(withPrimary.player.equipment.secondaryWeapon).toBeNull();

    // Add a second weapon and equip it
    const heavyWeapon: WeaponTemplate = {
      ...testWeapon,
      itemId: 'heavy',
      weapon: { ...testWeapon.weapon, damage: 20 },
    };
    const { state: s2 } = addItemToInventory(withPrimary, heavyWeapon);
    const heavyId = s2.player.inventory[0]!;

    const { state: withSecondary } = equipItem(s2, heavyId);
    expect(withSecondary.player.equipment.weapon).toBe(itemId);
    expect(withSecondary.player.equipment.secondaryWeapon).toBe(heavyId);
  });

  it('swapping recalculates stats based on active weapon', () => {
    const heavyWeapon: WeaponTemplate = {
      ...testWeapon,
      itemId: 'heavy',
      weapon: { ...testWeapon.weapon, damage: 20 },
    };

    let state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const { state: s2 } = addItemToInventory(s1, heavyWeapon);
    const lightId = s2.player.inventory[0]!;
    const heavyId = s2.player.inventory[1]!;

    const { state: withLight } = equipItem(s2, lightId);
    const { state: withBoth } = equipItem(withLight, heavyId);
    const attackWithLight = withBoth.player.stats.attack;

    const { state: withHeavy } = swapWeaponSets(withBoth);
    const attackWithHeavy = withHeavy.player.stats.attack;

    expect(attackWithHeavy).toBeGreaterThan(attackWithLight);
    expect(attackWithHeavy).toBe(withHeavy.player.baseStats.attack + 20);
  });
});
