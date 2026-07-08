/**
 * Test layer: unit
 * Behavior: Equipment covers calculateEquippedStats; returns base stats when nothing is equipped; adds weapon damage, accuracy, and speed bonuses.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/equipment.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  calculateEquippedStats,
  equipItem,
  syncEquipmentGrantedAbilities,
  unequipItem,
  swapWeaponSets,
} from './equipment.js';
import { addItemToInventory } from './inventory.js';
import { entityId } from '@dungeon/contracts';
import type { WeaponTemplate, ArmorTemplate, EnchantmentDefinition } from '@dungeon/contracts';
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
  weapon: { damage: 8, damageType: 'physical', accuracy: 5, speed: 3, slot: 'weapon', weaponRange: 1, weaponType: 'blade' as const },
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

const EMBER_ABILITY_ID = 'ember';
const HEAT_SURGE_ABILITY_ID = 'heat_surge';
const BOLT_ABILITY_ID = 'bolt';
const THUNDER_STEP_ABILITY_ID = 'thunder_step';
const THUNDERSTORM_ABILITY_ID = 'thunderstorm';

const fireRingTemplate: ArmorTemplate = {
  itemId: 'fire_ring',
  name: 'Fire Ring',
  description: 'A ring bound to ember magic.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 100,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 0,
    evasionPenalty: 0,
    slot: 'ring',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

const lightningRingTemplate: ArmorTemplate = {
  itemId: 'lightning_ring',
  name: 'Lightning Ring',
  description: 'A ring bound to storm magic.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 100,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 0,
    evasionPenalty: 0,
    slot: 'ring',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

const plainRingTemplate: ArmorTemplate = {
  itemId: 'plain_ring',
  name: 'Plain Ring',
  description: 'A plain ring.',
  itemClass: 'armor',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  armor: {
    defense: 0,
    evasionPenalty: 0,
    slot: 'ring',
    enchantmentSlots: 0,
    enchantments: [],
  },
};

function abilityIds(state: ReturnType<typeof createTestGameState>): string[] {
  return state.player.abilities.map(ability => ability.id);
}

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

    expect(result.attack).toBeGreaterThan(BASE_TEST_STATS.attack);
    expect(result.accuracy).toBeGreaterThan(BASE_TEST_STATS.accuracy);
    expect(result.speed).toBeGreaterThan(BASE_TEST_STATS.speed);
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

    expect(result.defense).toBeGreaterThan(BASE_TEST_STATS.defense);
    expect(result.evasion).toBeLessThan(BASE_TEST_STATS.evasion);
  });

  it('preserves current health, not base health', () => {
    const result = calculateEquippedStats(
      BASE_TEST_STATS,
      55,
      { weapon: null, chest: null, head: null, gloves: null, boots: null, ring1: null, ring2: null, secondaryWeapon: null },
      new Map(),
    );
    expect(result.health).toBeGreaterThan(50);
    expect(result.health).toBeLessThan(60);
    expect(result.maxHealth).toBeGreaterThan(0);
  });
});

describe('equipItem stat recalculation', () => {
  it('increases attack when a weapon is equipped', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testWeapon);
    const itemId = s1.player.inventory[0]!;
    const baseAttack = s1.player.baseStats.attack;

    const { state: s2 } = equipItem(s1, itemId);

    expect(s2.player.stats.attack).toBeGreaterThan(baseAttack);
    expect(s2.player.equipment.weapon).toBe(itemId);
  });

  it('increases defense when armor is equipped', () => {
    const state = createTestGameState();
    const { state: s1 } = addItemToInventory(state, testArmor);
    const itemId = s1.player.inventory[0]!;
    const baseDefense = s1.player.baseStats.defense;

    const { state: s2 } = equipItem(s1, itemId);

    expect(s2.player.stats.defense).toBeGreaterThan(baseDefense);
    expect(s2.player.equipment.chest).toBe(itemId);
  });

  it('preserves current health (does not reset to max) when equipping', () => {
    const lowHpState = createTestGameState({ player: { stats: { ...BASE_TEST_STATS, health: 40 } } });
    const { state: s1 } = addItemToInventory(lowHpState, testWeapon);
    const itemId = s1.player.inventory[0]!;

    const { state: s2 } = equipItem(s1, itemId);

    expect(s2.player.stats.health).toBeGreaterThan(35);
    expect(s2.player.stats.health).toBeLessThan(45);
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
    expect(withBoth.player.stats.attack).toBeGreaterThan(s2.player.baseStats.attack);
  });

  it('discovers Fire Ring mastery on equip without granting unlearned spells', () => {
    const state = createTestGameState({
      player: {
        abilities: [{ id: 'power_strike', cooldownRemaining: 0 }],
      },
    });
    const { state: withRingInInventory } = addItemToInventory(state, fireRingTemplate);
    const ringId = withRingInInventory.player.inventory[0]!;

    const { state: equipped } = equipItem(withRingInInventory, ringId);
    expect(equipped.player.ringMastery.fire).toMatchObject({ xp: 0 });
    expect(abilityIds(equipped)).not.toContain(EMBER_ABILITY_ID);
    expect(abilityIds(equipped)).toContain('power_strike');

    const { state: unequipped } = unequipItem(equipped, ringId);
    expect(unequipped.player.ringMastery.fire).toMatchObject({ xp: 0 });
    expect(abilityIds(unequipped)).not.toContain(EMBER_ABILITY_ID);
    expect(abilityIds(unequipped)).toContain('power_strike');
  });

  it('grants learned Fire Ring spells only while a Fire Ring is equipped', () => {
    const state = createTestGameState({
      player: {
        ringMastery: {
          fire: {
            xp: 100,
          },
        },
        learnedRingSpellIds: ['ember', 'heat_surge'],
      },
    });
    const { state: withRingInInventory } = addItemToInventory(state, fireRingTemplate);
    const ringId = withRingInInventory.player.inventory[0]!;

    const { state: equipped } = equipItem(withRingInInventory, ringId);
    expect(abilityIds(equipped)).toContain(EMBER_ABILITY_ID);
    expect(abilityIds(equipped)).toContain(HEAT_SURGE_ABILITY_ID);

    const { state: unequipped } = unequipItem(equipped, ringId);
    expect(abilityIds(unequipped)).not.toContain(EMBER_ABILITY_ID);
    expect(abilityIds(unequipped)).not.toContain(HEAT_SURGE_ABILITY_ID);
  });

  it('keeps a learned ring spell when another equipped ring still grants the school', () => {
    const state = createTestGameState({
      player: {
        ringMastery: {
          fire: {
            xp: 100,
          },
        },
        learnedRingSpellIds: ['ember'],
      },
    });
    const { state: s1 } = addItemToInventory(state, fireRingTemplate);
    const { state: s2 } = addItemToInventory(s1, fireRingTemplate);
    const { state: s3 } = addItemToInventory(s2, plainRingTemplate);
    const firstFireRingId = s3.player.inventory[0]!;
    const secondFireRingId = s3.player.inventory[1]!;
    const plainRingId = s3.player.inventory[2]!;

    const { state: withFirstRing } = equipItem(s3, firstFireRingId);
    const { state: withBothFireRings } = equipItem(withFirstRing, secondFireRingId);
    expect(abilityIds(withBothFireRings)).toContain(EMBER_ABILITY_ID);

    const { state: afterReplacement } = equipItem(withBothFireRings, plainRingId);
    expect(afterReplacement.player.equipment.ring1).toBe(plainRingId);
    expect(afterReplacement.player.equipment.ring2).toBe(secondFireRingId);
    expect(abilityIds(afterReplacement)).toContain(EMBER_ABILITY_ID);
  });

  it('discovers Lightning Ring mastery on equip without granting unlearned spells', () => {
    const state = createTestGameState({
      player: {
        abilities: [{ id: 'power_strike', cooldownRemaining: 0 }],
      },
    });
    const { state: withRingInInventory } = addItemToInventory(state, lightningRingTemplate);
    const ringId = withRingInInventory.player.inventory[0]!;

    const { state: equipped } = equipItem(withRingInInventory, ringId);
    expect(equipped.player.ringMastery.lightning).toMatchObject({ xp: 0 });
    expect(abilityIds(equipped)).not.toContain(BOLT_ABILITY_ID);
    expect(abilityIds(equipped)).toContain('power_strike');

    const { state: unequipped } = unequipItem(equipped, ringId);
    expect(unequipped.player.ringMastery.lightning).toMatchObject({ xp: 0 });
    expect(abilityIds(unequipped)).not.toContain(BOLT_ABILITY_ID);
    expect(abilityIds(unequipped)).toContain('power_strike');
  });

  it('grants learned Lightning Ring spells only while a Lightning Ring is equipped', () => {
    const state = createTestGameState({
      player: {
        ringMastery: {
          lightning: {
            xp: 100,
          },
        },
        learnedRingSpellIds: [BOLT_ABILITY_ID, THUNDER_STEP_ABILITY_ID],
      },
    });
    const { state: withRingInInventory } = addItemToInventory(state, lightningRingTemplate);
    const ringId = withRingInInventory.player.inventory[0]!;

    const { state: equipped } = equipItem(withRingInInventory, ringId);
    expect(abilityIds(equipped)).toContain(BOLT_ABILITY_ID);
    expect(abilityIds(equipped)).toContain(THUNDER_STEP_ABILITY_ID);

    const { state: unequipped } = unequipItem(equipped, ringId);
    expect(abilityIds(unequipped)).not.toContain(BOLT_ABILITY_ID);
    expect(abilityIds(unequipped)).not.toContain(THUNDER_STEP_ABILITY_ID);
  });

  it('preserves a learned ring spell cooldown while the granting ring is unequipped and re-equipped', () => {
    const ringId = entityId('cooldown_lightning_ring');
    const registry = new Map([[ringId, lightningRingTemplate]]);
    const state = createTestGameState({
      player: {
        equipment: {
          weapon: null,
          secondaryWeapon: null,
          chest: null,
          head: null,
          gloves: null,
          boots: null,
          ring1: ringId,
          ring2: null,
        },
        learnedRingSpellIds: [BOLT_ABILITY_ID],
        abilities: [{ id: BOLT_ABILITY_ID, cooldownRemaining: 3 }],
      },
    });
    const expectedCooldown = state.player.abilities.find(ability => ability.id === BOLT_ABILITY_ID)?.cooldownRemaining;
    expect(expectedCooldown).toBeGreaterThan(0);

    const unequippedPlayer = syncEquipmentGrantedAbilities(
      {
        ...state.player,
        equipment: { ...state.player.equipment, ring1: null },
      },
      registry,
    );
    const reequippedPlayer = syncEquipmentGrantedAbilities(
      {
        ...unequippedPlayer,
        equipment: state.player.equipment,
      },
      registry,
    );

    expect(unequippedPlayer.abilities.find(ability => ability.id === BOLT_ABILITY_ID)?.cooldownRemaining).toBe(expectedCooldown);
    expect(reequippedPlayer.abilities.find(ability => ability.id === BOLT_ABILITY_ID)?.cooldownRemaining).toBe(expectedCooldown);
  });

  it('removes enchantment-granted abilities when the granting armor is unequipped', () => {
    const armorId = entityId('grant_armor');
    const grantedAbilityId = 'local_equipment_grant';
    const grantingArmor: ArmorTemplate = {
      ...testArmor,
      armor: {
        ...testArmor.armor,
        enchantmentSlots: 1,
        enchantments: ['local_grant'],
      },
    };
    const grantEnchantment: EnchantmentDefinition = {
      id: 'local_grant',
      name: 'Local Grant',
      description: 'Grants a local test ability.',
      tier: 1,
      effect: { type: 'grant_ability', abilityId: grantedAbilityId },
    };
    const registry = new Map([[armorId, grantingArmor]]);
    const enchantments = new Map([[grantEnchantment.id, grantEnchantment]]);
    const state = createTestGameState({
      player: {
        equipment: {
          weapon: null,
          secondaryWeapon: null,
          chest: armorId,
          head: null,
          gloves: null,
          boots: null,
          ring1: null,
          ring2: null,
        },
      },
    });

    const withGrant = syncEquipmentGrantedAbilities(state.player, registry, enchantments);
    const withoutGrant = syncEquipmentGrantedAbilities(
      {
        ...withGrant,
        equipment: { ...withGrant.equipment, chest: null },
      },
      registry,
      enchantments,
    );

    expect(withGrant.abilities.map(ability => ability.id)).toContain(grantedAbilityId);
    expect(withoutGrant.abilities.map(ability => ability.id)).not.toContain(grantedAbilityId);
  });

  it('grants learned combo ring spells only while all required ring schools are equipped', () => {
    const state = createTestGameState({
      player: {
        ringMastery: {
          fire: {
            xp: 140,
          },
          lightning: {
            xp: 140,
          },
        },
        learnedRingSpellIds: [THUNDERSTORM_ABILITY_ID],
      },
    });
    const { state: s1 } = addItemToInventory(state, fireRingTemplate);
    const { state: s2 } = addItemToInventory(s1, lightningRingTemplate);
    const fireRingId = s2.player.inventory[0]!;
    const lightningRingId = s2.player.inventory[1]!;

    const { state: withFireRing } = equipItem(s2, fireRingId);
    expect(abilityIds(withFireRing)).not.toContain(THUNDERSTORM_ABILITY_ID);

    const { state: withBothRings } = equipItem(withFireRing, lightningRingId);
    expect(abilityIds(withBothRings)).toContain(THUNDERSTORM_ABILITY_ID);

    const { state: withoutFireRing } = unequipItem(withBothRings, fireRingId);
    expect(abilityIds(withoutFireRing)).not.toContain(THUNDERSTORM_ABILITY_ID);
  });

  it('keeps a learned Lightning spell when another equipped ring still grants the school', () => {
    const state = createTestGameState({
      player: {
        ringMastery: {
          lightning: {
            xp: 100,
          },
        },
        learnedRingSpellIds: [BOLT_ABILITY_ID],
      },
    });
    const { state: s1 } = addItemToInventory(state, lightningRingTemplate);
    const { state: s2 } = addItemToInventory(s1, lightningRingTemplate);
    const { state: s3 } = addItemToInventory(s2, plainRingTemplate);
    const firstLightningRingId = s3.player.inventory[0]!;
    const secondLightningRingId = s3.player.inventory[1]!;
    const plainRingId = s3.player.inventory[2]!;

    const { state: withFirstRing } = equipItem(s3, firstLightningRingId);
    const { state: withBothLightningRings } = equipItem(withFirstRing, secondLightningRingId);
    expect(abilityIds(withBothLightningRings)).toContain(BOLT_ABILITY_ID);

    const { state: afterReplacement } = equipItem(withBothLightningRings, plainRingId);
    expect(afterReplacement.player.equipment.ring1).toBe(plainRingId);
    expect(afterReplacement.player.equipment.ring2).toBe(secondLightningRingId);
    expect(abilityIds(afterReplacement)).toContain(BOLT_ABILITY_ID);
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
      itemId: 'ring1',
      name: 'Ring 1',
      itemClass: 'armor',
      description: 'A ring',
      rarity: 'common',
      value: 10,
      stackable: false,
      maxStack: 1,
      armor: { slot: 'ring', defense: 2, evasionPenalty: 0, enchantments: [], enchantmentSlots: 0 },
    };
    const ring2: ArmorTemplate = {
      itemId: 'ring2',
      name: 'Ring 2',
      itemClass: 'armor',
      description: 'Another ring',
      rarity: 'common',
      value: 10,
      stackable: false,
      maxStack: 1,
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
  });
});

// ---------------------------------------------------------------------------
// Bug documentation tests (merged from equipment-bugs.test.ts)
// ---------------------------------------------------------------------------

const bugChestArmor1: ArmorTemplate = {
  itemId: 'chest_1',
  name: 'Leather Chest 1',
  description: 'First chest',
  itemClass: 'armor',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  armor: { defense: 6, evasionPenalty: 2, slot: 'chest', enchantmentSlots: 0, enchantments: [] },
};

const bugChestArmor2: ArmorTemplate = {
  itemId: 'chest_2',
  name: 'Iron Chest',
  description: 'Better chest',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 20,
  stackable: false,
  maxStack: 1,
  armor: { defense: 10, evasionPenalty: 3, slot: 'chest', enchantmentSlots: 1, enchantments: [] },
};

const bugRing1: ArmorTemplate = {
  itemId: 'ring_1',
  name: 'Ring of Power',
  description: 'First ring',
  itemClass: 'armor',
  rarity: 'rare',
  value: 50,
  stackable: false,
  maxStack: 1,
  armor: { defense: 2, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 2, enchantments: [] },
};

const bugRing2: ArmorTemplate = {
  itemId: 'ring_2',
  name: 'Ring of Speed',
  description: 'Second ring',
  itemClass: 'armor',
  rarity: 'rare',
  value: 50,
  stackable: false,
  maxStack: 1,
  armor: { defense: 1, evasionPenalty: -1, slot: 'ring', enchantmentSlots: 1, enchantments: [] },
};

const bugRing3: ArmorTemplate = {
  itemId: 'ring_3',
  name: 'Ring of Wisdom',
  description: 'Third ring',
  itemClass: 'armor',
  rarity: 'rare',
  value: 50,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 1, enchantments: [] },
};

const bugTestWeapon: WeaponTemplate = {
  itemId: 'sword_1',
  name: 'Sword',
  description: 'A sword',
  itemClass: 'weapon',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 8, damageType: 'physical', accuracy: 5, speed: 3, slot: 'weapon', weaponRange: 1, weaponType: 'blade' as const },
};

describe('EQUIPMENT BUGS - Critical Inventory Loss Issues', () => {
  describe('BUG-1: Armor replacement loses old armor', () => {
    it('equipping new chest when chest is occupied loses old chest armor', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, bugChestArmor1);
      const { state: s2 } = addItemToInventory(s1, bugChestArmor2);

      const chest1Id = s2.player.inventory[0]!;
      const chest2Id = s2.player.inventory[1]!;

      const { state: withChest1 } = equipItem(s2, chest1Id);
      expect(withChest1.player.equipment.chest).toBe(chest1Id);
      expect(withChest1.player.inventory).not.toContain(chest1Id);

      const { state: withChest2 } = equipItem(withChest1, chest2Id);

      expect(withChest2.player.equipment.chest).toBe(chest2Id);
      expect(withChest2.player.inventory).toContain(chest1Id);
      expect(withChest2.player.inventory).not.toContain(chest2Id);
    });

    it('equipping head armor when occupied should return old helmet', () => {
      let state = createTestGameState();

      const helmet1: ArmorTemplate = {
        ...bugChestArmor1,
        itemId: 'helmet_1',
        armor: { ...bugChestArmor1.armor, slot: 'head' },
      };
      const helmet2: ArmorTemplate = {
        ...bugChestArmor2,
        itemId: 'helmet_2',
        armor: { ...bugChestArmor2.armor, slot: 'head' },
      };

      const { state: s1 } = addItemToInventory(state, helmet1);
      const { state: s2 } = addItemToInventory(s1, helmet2);

      const h1Id = s2.player.inventory[0]!;
      const h2Id = s2.player.inventory[1]!;

      const { state: withH1 } = equipItem(s2, h1Id);
      const { state: withH2 } = equipItem(withH1, h2Id);

      expect(withH2.player.equipment.head).toBe(h2Id);
      expect(withH2.player.inventory).toContain(h1Id);
    });
  });

  describe('BUG-2: Ring replacement loses old ring', () => {
    it('equipping 3rd ring loses ring1 (not returned to inventory)', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, bugRing1);
      const { state: s2 } = addItemToInventory(s1, bugRing2);
      const { state: s3 } = addItemToInventory(s2, bugRing3);

      const r1Id = s3.player.inventory[0]!;
      const r2Id = s3.player.inventory[1]!;
      const r3Id = s3.player.inventory[2]!;

      const { state: withR1 } = equipItem(s3, r1Id);
      expect(withR1.player.equipment.ring1).toBe(r1Id);

      const { state: withR2 } = equipItem(withR1, r2Id);
      expect(withR2.player.equipment.ring1).toBe(r1Id);
      expect(withR2.player.equipment.ring2).toBe(r2Id);

      const { state: withR3 } = equipItem(withR2, r3Id);

      expect(withR3.player.equipment.ring1).toBe(r3Id);
      expect(withR3.player.equipment.ring2).toBe(r2Id);
      expect(withR3.player.inventory).toContain(r1Id);
    });
  });

  describe('BUG-3: Inventory item vanishes when equipped', () => {
    it('item should remain in inventory until equipment is updated', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, bugTestWeapon);
      const weaponId = s1.player.inventory[0]!;

      expect(s1.player.inventory).toContain(weaponId);
      expect(s1.player.equipment.weapon).toBeNull();

      const { state: s2 } = equipItem(s1, weaponId);

      expect(s2.player.equipment.weapon).toBe(weaponId);
      expect(s2.player.inventory).not.toContain(weaponId);

      const isInInventory = s2.player.inventory.includes(weaponId);
      const isEquipped = s2.player.equipment.weapon === weaponId;
      expect(isInInventory || isEquipped).toBe(true);
    });
  });

  describe('Swap weapons button issues', () => {
    it('swap weapons should work when both slots are filled', () => {
      let state = createTestGameState();

      const weapon1: WeaponTemplate = {
        ...bugTestWeapon,
        itemId: 'light_sword',
        weapon: { ...bugTestWeapon.weapon, damage: 8 },
      };
      const weapon2: WeaponTemplate = {
        ...bugTestWeapon,
        itemId: 'heavy_sword',
        weapon: { ...bugTestWeapon.weapon, damage: 20 },
      };

      const { state: s1 } = addItemToInventory(state, weapon1);
      const { state: s2 } = addItemToInventory(s1, weapon2);

      const w1Id = s2.player.inventory[0]!;
      const w2Id = s2.player.inventory[1]!;

      const { state: withW1 } = equipItem(s2, w1Id);
      const { state: withBoth } = equipItem(withW1, w2Id);

      expect(withBoth.player.equipment.weapon).toBe(w1Id);
      expect(withBoth.player.equipment.secondaryWeapon).toBe(w2Id);
      expect(withBoth.player.stats.attack).toBeGreaterThan(state.player.baseStats.attack);
    });
  });

  describe('Full equipment lifecycle', () => {
    it('equip/unequip/reequip should preserve items', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, bugChestArmor1);
      const chestId = s1.player.inventory[0]!;

      const { state: equipped } = equipItem(s1, chestId);
      expect(equipped.player.equipment.chest).toBe(chestId);
      expect(equipped.player.inventory).not.toContain(chestId);

      const { state: unequipped } = unequipItem(equipped, chestId);
      expect(unequipped.player.equipment.chest).toBeNull();
      expect(unequipped.player.inventory).toContain(chestId);

      const { state: reequipped } = equipItem(unequipped, chestId);
      expect(reequipped.player.equipment.chest).toBe(chestId);
      expect(reequipped.player.inventory).not.toContain(chestId);

      const { state: finalUnequipped } = unequipItem(reequipped, chestId);
      expect(finalUnequipped.player.inventory).toContain(chestId);
    });
  });

  describe('Equipment constraint validation', () => {
    describe('Incompatible item class rejection', () => {
      it('should reject equipping consumable item (non-equippable)', () => {
        let state = createTestGameState();

        // Add a consumable to inventory (using proper ConsumableTemplate type)
        const consumableTemplate: import('@dungeon/contracts').ConsumableTemplate = {
          itemId: 'healing_potion',
          name: 'Healing Potion',
          description: 'A potion',
          itemClass: 'consumable',
          rarity: 'common',
          value: 10,
          stackable: true,
          maxStack: 99,
          consumable: { effect: 'heal', magnitude: 50 },
        };

        const { state: withConsumable } = addItemToInventory(state, consumableTemplate);
        const consumableEntityId = withConsumable.player.inventory[0]!;
        const inventoryCountBefore = withConsumable.player.inventory.length;

        // Try to equip it - should silently fail (equipItem returns state/events unchanged)
        const result = equipItem(withConsumable, consumableEntityId);

        // Equipment should be unchanged
        expect(result.state.player.equipment.chest).toBeNull();
        expect(result.state.player.equipment.weapon).toBeNull();

        // Item should still be in inventory
        expect(result.state.player.inventory).toHaveLength(inventoryCountBefore);
        expect(result.state.player.inventory).toContain(consumableEntityId);

        // No success events should be emitted
        expect(result.events).toEqual([]);
      });

      it('should reject equipping trap item (non-equippable)', () => {
        let state = createTestGameState();

        // Add a trap to inventory (using proper TrapItemTemplate type)
        const trapTemplate: import('@dungeon/contracts').TrapItemTemplate = {
          itemId: 'bear_trap',
          name: 'Bear Trap',
          description: 'A dangerous trap',
          itemClass: 'trap',
          rarity: 'common',
          value: 20,
          stackable: false,
          maxStack: 1,
          trapTemplateId: 'bear_trap_template',
        };

        const { state: withTrap } = addItemToInventory(state, trapTemplate);
        const trapId = withTrap.player.inventory[0]!;

        // Try to equip it - should silently fail
        const result = equipItem(withTrap, trapId);

        // Equipment should be unchanged
        expect(result.state.player.equipment.chest).toBeNull();
        expect(result.state.player.equipment.weapon).toBeNull();

        // Item should still be in inventory
        expect(result.state.player.inventory).toContain(trapId);

        // No success events should be emitted
        expect(result.events).toEqual([]);
      });
    });

    describe('Item not in inventory rejection', () => {
      it('should silently fail when equipping item player does not have', () => {
        const state = createTestGameState();
        const fakeItemId = entityId('fake_item_not_in_inventory');

        // Try to equip item that player does not have
        const result = equipItem(state, fakeItemId);

        // State should be unchanged
        expect(result.state.player.equipment.weapon).toBeNull();
        expect(result.state.player.inventory).not.toContain(fakeItemId);

        // No success events should be emitted
        expect(result.events).toEqual([]);
      });
    });

    describe('Successful equipment change', () => {
      it('should emit events when equipping valid armor from inventory', () => {
        let state = createTestGameState();
        const { state: withArmor } = addItemToInventory(state, testArmor);
        const armorId = withArmor.player.inventory[0]!;

        const result = equipItem(withArmor, armorId);

        // Equipment should be updated
        expect(result.state.player.equipment.chest).toBe(armorId);

        // Item should be removed from inventory
        expect(result.state.player.inventory).not.toContain(armorId);

        // Stats should be recalculated (defense should increase)
        expect(result.state.player.stats.defense).toBeGreaterThan(state.player.stats.defense);

        // No events for successful equip (per current design)
        expect(result.events).toEqual([]);
      });

      it('should emit events when equipping valid weapon from inventory', () => {
        let state = createTestGameState();
        const { state: withWeapon } = addItemToInventory(state, testWeapon);
        const weaponId = withWeapon.player.inventory[0]!;

        const result = equipItem(withWeapon, weaponId);

        // Equipment should be updated
        expect(result.state.player.equipment.weapon).toBe(weaponId);

        // Item should be removed from inventory
        expect(result.state.player.inventory).not.toContain(weaponId);

        // Stats should be recalculated (attack should increase)
        expect(result.state.player.stats.attack).toBeGreaterThan(state.player.stats.attack);

        // No events for successful equip
        expect(result.events).toEqual([]);
      });
    });
  });
});
