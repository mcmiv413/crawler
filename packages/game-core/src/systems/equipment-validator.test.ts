/**
 * Test layer: unit
 * Behavior: Equipment Validator covers validateEquipmentAction; item not found; rejects when item entity id is not in registry.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/equipment-validator.test.ts
 */
/**
 * Contract tests for the centralized equipment action validator.
 *
 * Proves: allow on valid input, reject on invalid input, stable reason codes,
 * player-readable messages, no state mutation.
 */

import { describe, it, expect } from 'vitest';
import { validateEquipmentAction } from './equipment-validator.js';
import { createTestGameState } from '../test-utils.js';
import {
  ITEM_NOT_FOUND,
  ITEM_NOT_EQUIPPABLE,
  ITEM_NOT_IN_INVENTORY,
  EQUIPMENT_INCOMPATIBLE,
} from '../engine/rejection-codes.js';
import { entityId } from '@dungeon/contracts';
import type { AnyItemTemplate, WeaponTemplate, ArmorTemplate } from '@dungeon/contracts';

function makeWeaponState() {
  const itemEntityId = entityId('sword1');
  const weaponTemplate: WeaponTemplate = {
    itemId: 'rusty_sword',
    name: 'Rusty Sword',
    description: 'A rusty sword',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    itemClass: 'weapon',
    weapon: {
      weaponType: 'blade',
      damageType: 'physical',
      weaponRange: 1,
      damage: 8,
      accuracy: 0,
      speed: 100,
      slot: 'weapon',
    },
  };
  const state = createTestGameState();
  return {
    itemEntityId,
    state: {
      ...state,
      player: {
        ...state.player,
        inventory: [itemEntityId],
      },
      itemRegistry: {
        items: new Map([[itemEntityId, weaponTemplate as AnyItemTemplate]]),
      },
    },
  };
}

function makeArmorState() {
  const itemEntityId = entityId('armor1');
  const armorTemplate: ArmorTemplate = {
    itemId: 'leather_vest',
    name: 'Leather Vest',
    description: 'A vest',
    rarity: 'common',
    value: 8,
    stackable: false,
    maxStack: 1,
    itemClass: 'armor',
    armor: {
      slot: 'chest',
      defense: 3,
      evasionPenalty: 0,
      enchantmentSlots: 2,
      enchantments: [null, null],
    },
  };
  const state = createTestGameState();
  return {
    itemEntityId,
    state: {
      ...state,
      player: {
        ...state.player,
        inventory: [itemEntityId],
      },
      itemRegistry: {
        items: new Map([[itemEntityId, armorTemplate as AnyItemTemplate]]),
      },
    },
  };
}

describe('validateEquipmentAction', () => {
  describe('item not found', () => {
    it('rejects when item entity id is not in registry', () => {
      const state = createTestGameState();
      const missingId = entityId('not_in_registry');
      const result = validateEquipmentAction(state, missingId);
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(ITEM_NOT_FOUND);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('item not equippable', () => {
    it('rejects when item class is not weapon or armor', () => {
      const itemEntityId = entityId('potion1');
      const consumable = {
        itemId: 'health_potion',
        name: 'Health Potion',
        description: 'A potion',
        rarity: 'common',
        value: 5,
        ascii: '!',
        itemClass: 'consumable',
      } as unknown as AnyItemTemplate;
      const state = createTestGameState();
      const stateWithConsumable = {
        ...state,
        player: { ...state.player, inventory: [itemEntityId] },
        itemRegistry: { items: new Map([[itemEntityId, consumable]]) },
      };
      const result = validateEquipmentAction(stateWithConsumable, itemEntityId);
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(ITEM_NOT_EQUIPPABLE);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('item not in inventory', () => {
    it('rejects when item is in registry but not in player inventory', () => {
      const itemEntityId = entityId('sword_not_owned');
      const weaponTemplate: WeaponTemplate = {
        itemId: 'rusty_sword',
        name: 'Rusty Sword',
        description: 'A rusty sword',
        rarity: 'common',
        value: 10,
        stackable: false,
        maxStack: 1,
        itemClass: 'weapon',
        weapon: {
          weaponType: 'blade',
          damageType: 'physical',
          weaponRange: 1,
          damage: 8,
          accuracy: 0,
          speed: 100,
          slot: 'weapon',
        },
      };
      const state = createTestGameState();
      const stateWithRegistry = {
        ...state,
        // inventory does NOT include itemEntityId
        itemRegistry: { items: new Map([[itemEntityId, weaponTemplate as AnyItemTemplate]]) },
      };
      const result = validateEquipmentAction(stateWithRegistry, itemEntityId);
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(ITEM_NOT_IN_INVENTORY);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('valid weapon equip', () => {
    it('allows equipping a weapon the player owns', () => {
      const { itemEntityId, state } = makeWeaponState();
      const result = validateEquipmentAction(state, itemEntityId);
      expect(result.valid).toBe(true);
    });
  });

  describe('valid armor equip', () => {
    it('allows equipping armor with a valid slot', () => {
      const { itemEntityId, state } = makeArmorState();
      const result = validateEquipmentAction(state, itemEntityId);
      expect(result.valid).toBe(true);
    });
  });

  describe('equipment incompatible', () => {
    it('rejects armor with an invalid slot name', () => {
      const itemEntityId = entityId('bad_armor');
      const badArmor = {
        itemId: 'bad_armor',
        name: 'Bad Armor',
        description: 'Bad',
        rarity: 'common',
        value: 5,
        ascii: 'x',
        itemClass: 'armor',
        armor: {
          slot: 'invalid_slot',
          defense: 2,
          enchantmentSlots: 0,
          enchantments: [],
        },
      } as unknown as AnyItemTemplate;
      const state = createTestGameState();
      const stateWithBadArmor = {
        ...state,
        player: { ...state.player, inventory: [itemEntityId] },
        itemRegistry: { items: new Map([[itemEntityId, badArmor]]) },
      };
      const result = validateEquipmentAction(stateWithBadArmor, itemEntityId);
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(result.rejectionCode).toBe(EQUIPMENT_INCOMPATIBLE);
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });

  describe('state immutability', () => {
    it('does not mutate state on rejection', () => {
      const state = createTestGameState();
      const originalGold = state.player.gold;
      const originalInventoryLength = state.player.inventory.length;

      validateEquipmentAction(state, entityId('nonexistent'));

      expect(state.player.gold).toBe(originalGold);
      expect(state.player.inventory.length).toBe(originalInventoryLength);
    });

    it('does not mutate state on allow', () => {
      const { itemEntityId, state } = makeWeaponState();
      const originalInventoryLength = state.player.inventory.length;

      validateEquipmentAction(state, itemEntityId);

      expect(state.player.inventory.length).toBe(originalInventoryLength);
    });
  });

  describe('result contract', () => {
    it('rejection result always has rejectionCode and message', () => {
      const state = createTestGameState();
      const result = validateEquipmentAction(state, entityId('nonexistent'));
      expect(result.valid).toBe(false);
      if (result.valid === false) {
        expect(typeof result.rejectionCode).toBe('string');
        expect(result.rejectionCode.length).toBeGreaterThan(0);
        expect(typeof result.message).toBe('string');
        expect(result.message.length).toBeGreaterThan(0);
      }
    });
  });
});
