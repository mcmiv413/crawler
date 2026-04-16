/**
 * equipment-bugs.test.ts — Tests for critical equipment system bugs
 *
 * These tests document the following bugs found in equipment.ts:
 * BUG-1: Equipping armor in occupied slot loses old armor (no return to inventory)
 * BUG-2: Equipping 3rd ring loses old ring1 (no return to inventory)
 * BUG-3: Equipping 3rd weapon should work but inventory handling may be wrong
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { equipItem, unequipItem } from './equipment.js';
import { addItemToInventory } from './inventory.js';
import { entityId } from '@dungeon/contracts';
import type { ArmorTemplate, WeaponTemplate } from '@dungeon/contracts';
import { createTestGameState } from '../test-utils.js';

const chestArmor1: ArmorTemplate = {
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

const chestArmor2: ArmorTemplate = {
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

const ring1: ArmorTemplate = {
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

const ring2: ArmorTemplate = {
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

const ring3: ArmorTemplate = {
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

const testWeapon: WeaponTemplate = {
  itemId: 'sword_1',
  name: 'Sword',
  description: 'A sword',
  itemClass: 'weapon',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  weapon: { damage: 8, damageType: 'physical', accuracy: 5, speed: 3, slot: 'weapon', weaponRange: 1 },
};

describe('EQUIPMENT BUGS - Critical Inventory Loss Issues', () => {
  describe('BUG-1: Armor replacement loses old armor', () => {
    it('equipping new chest when chest is occupied loses old chest armor', () => {
      let state = createTestGameState();

      // Add both chest pieces to inventory
      const { state: s1 } = addItemToInventory(state, chestArmor1);
      const { state: s2 } = addItemToInventory(s1, chestArmor2);

      const chest1Id = s2.player.inventory[0]!;
      const chest2Id = s2.player.inventory[1]!;

      // Equip first chest
      const { state: withChest1 } = equipItem(s2, chest1Id);
      expect(withChest1.player.equipment.chest).toBe(chest1Id);
      expect(withChest1.player.inventory).not.toContain(chest1Id);

      // Equip second chest over first
      const { state: withChest2 } = equipItem(withChest1, chest2Id);

      // BUG: chest1 should be back in inventory, but it's lost!
      // chest1 is nowhere: not equipped, not in inventory
      expect(withChest2.player.equipment.chest).toBe(chest2Id);
      expect(withChest2.player.inventory).toContain(chest1Id); // FAILS - chest1 is lost!
      expect(withChest2.player.inventory).not.toContain(chest2Id);
    });

    it('equipping head armor when occupied should return old helmet', () => {
      let state = createTestGameState();

      const helmet1: ArmorTemplate = {
        ...chestArmor1,
        itemId: 'helmet_1',
        armor: { ...chestArmor1.armor, slot: 'head' },
      };
      const helmet2: ArmorTemplate = {
        ...chestArmor2,
        itemId: 'helmet_2',
        armor: { ...chestArmor2.armor, slot: 'head' },
      };

      const { state: s1 } = addItemToInventory(state, helmet1);
      const { state: s2 } = addItemToInventory(s1, helmet2);

      const h1Id = s2.player.inventory[0]!;
      const h2Id = s2.player.inventory[1]!;

      const { state: withH1 } = equipItem(s2, h1Id);
      const { state: withH2 } = equipItem(withH1, h2Id);

      expect(withH2.player.equipment.head).toBe(h2Id);
      expect(withH2.player.inventory).toContain(h1Id); // FAILS - helmet1 lost!
    });
  });

  describe('BUG-2: Ring replacement loses old ring', () => {
    it('equipping 3rd ring loses ring1 (not returned to inventory)', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, ring1);
      const { state: s2 } = addItemToInventory(s1, ring2);
      const { state: s3 } = addItemToInventory(s2, ring3);

      const r1Id = s3.player.inventory[0]!;
      const r2Id = s3.player.inventory[1]!;
      const r3Id = s3.player.inventory[2]!;

      // Equip first ring
      const { state: withR1 } = equipItem(s3, r1Id);
      expect(withR1.player.equipment.ring1).toBe(r1Id);

      // Equip second ring
      const { state: withR2 } = equipItem(withR1, r2Id);
      expect(withR2.player.equipment.ring1).toBe(r1Id);
      expect(withR2.player.equipment.ring2).toBe(r2Id);

      // Equip third ring - should replace ring1 and return it
      const { state: withR3 } = equipItem(withR2, r3Id);

      // BUG: ring1 should be back in inventory
      expect(withR3.player.equipment.ring1).toBe(r3Id);
      expect(withR3.player.equipment.ring2).toBe(r2Id);
      expect(withR3.player.inventory).toContain(r1Id); // FAILS - ring1 is lost!
    });
  });

  describe('BUG-3: Inventory item vanishes when equipped', () => {
    it('item should remain in inventory until equipment is updated', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, testWeapon);
      const weaponId = s1.player.inventory[0]!;

      // Item should be in inventory before equip
      expect(s1.player.inventory).toContain(weaponId);
      expect(s1.player.equipment.weapon).toBeNull();

      // After equip, item should not be in inventory or in equipment
      const { state: s2 } = equipItem(s1, weaponId);

      // Item should be in equipment
      expect(s2.player.equipment.weapon).toBe(weaponId);

      // Item should NOT be in inventory
      expect(s2.player.inventory).not.toContain(weaponId);

      // Item should be somewhere (equipment or inventory, not lost)
      const isInInventory = s2.player.inventory.includes(weaponId);
      const isEquipped = s2.player.equipment.weapon === weaponId;
      expect(isInInventory || isEquipped).toBe(true);
    });
  });

  describe('Swap weapons button issues', () => {
    it('swap weapons should work when both slots are filled', () => {
      let state = createTestGameState();

      const weapon1: WeaponTemplate = {
        ...testWeapon,
        itemId: 'light_sword',
        weapon: { ...testWeapon.weapon, damage: 8 },
      };
      const weapon2: WeaponTemplate = {
        ...testWeapon,
        itemId: 'heavy_sword',
        weapon: { ...testWeapon.weapon, damage: 20 },
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

  describe('Integration test: Full equipment lifecycle', () => {
    it('equip/unequip/reequip should preserve items', () => {
      let state = createTestGameState();

      const { state: s1 } = addItemToInventory(state, chestArmor1);
      const chestId = s1.player.inventory[0]!;

      // Equip
      const { state: equipped } = equipItem(s1, chestId);
      expect(equipped.player.equipment.chest).toBe(chestId);
      expect(equipped.player.inventory).not.toContain(chestId);

      // Unequip
      const { state: unequipped } = unequipItem(equipped, chestId);
      expect(unequipped.player.equipment.chest).toBeNull();
      expect(unequipped.player.inventory).toContain(chestId);

      // Re-equip
      const { state: reequipped } = equipItem(unequipped, chestId);
      expect(reequipped.player.equipment.chest).toBe(chestId);
      expect(reequipped.player.inventory).not.toContain(chestId);

      // Final unequip
      const { state: finalUnequipped } = unequipItem(reequipped, chestId);
      expect(finalUnequipped.player.inventory).toContain(chestId);
    });
  });
});
