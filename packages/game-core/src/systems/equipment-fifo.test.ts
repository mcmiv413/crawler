import { describe, it, expect, beforeEach } from 'vitest';
import { equipItem } from './equipment.js';
import { createTestGameState } from '../test-utils.js';
import type { WeaponTemplate, ArmorTemplate, GameState, EntityId, AnyItemTemplate } from '@dungeon/contracts';
import { entityId } from '@dungeon/contracts';

describe('equipment FIFO behavior', () => {
  let state: GameState;

  const sword: WeaponTemplate = {
    itemId: 'sword_test',
    name: 'Test Sword',
    description: 'A sword',
    itemClass: 'weapon',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    weapon: { damage: 8, damageType: 'physical', accuracy: 5, speed: 3, slot: 'weapon', weaponRange: 1, weaponType: 'blade' },
  };

  const axe: WeaponTemplate = {
    itemId: 'axe_test',
    name: 'Test Axe',
    description: 'An axe',
    itemClass: 'weapon',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    weapon: { damage: 10, damageType: 'physical', accuracy: 3, speed: 2, slot: 'weapon', weaponRange: 1, weaponType: 'axe' },
  };

  const mace: WeaponTemplate = {
    itemId: 'mace_test',
    name: 'Test Mace',
    description: 'A mace',
    itemClass: 'weapon',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    weapon: { damage: 9, damageType: 'physical', accuracy: 4, speed: 2, slot: 'weapon', weaponRange: 1, weaponType: 'bludgeon' },
  };

  const ring1: ArmorTemplate = {
    itemId: 'ring_fire_test',
    name: 'Fire Ring',
    description: 'A fire ring',
    itemClass: 'armor',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    armor: { defense: 0, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 0, enchantments: [] },
  };

  const ring2: ArmorTemplate = {
    itemId: 'ring_ice_test',
    name: 'Ice Ring',
    description: 'An ice ring',
    itemClass: 'armor',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    armor: { defense: 0, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 0, enchantments: [] },
  };

  const ring3: ArmorTemplate = {
    itemId: 'ring_light_test',
    name: 'Light Ring',
    description: 'A light ring',
    itemClass: 'armor',
    rarity: 'common',
    value: 10,
    stackable: false,
    maxStack: 1,
    armor: { defense: 0, evasionPenalty: 0, slot: 'ring', enchantmentSlots: 0, enchantments: [] },
  };

  beforeEach(() => {
    const baseState = createTestGameState();
    state = {
      ...baseState,
      itemRegistry: {
        items: new Map<EntityId, AnyItemTemplate>([
          [entityId('sword_test'), sword],
          [entityId('axe_test'), axe],
          [entityId('mace_test'), mace],
          [entityId('ring_fire_test'), ring1],
          [entityId('ring_ice_test'), ring2],
          [entityId('ring_light_test'), ring3],
        ]),
      },
      player: {
        ...baseState.player,
        inventory: [entityId('sword_test'), entityId('axe_test'), entityId('mace_test'), entityId('ring_fire_test'), entityId('ring_ice_test'), entityId('ring_light_test')],
      },
    };
  });

  describe('weapon FIFO', () => {
    it('equips first weapon to primary slot', () => {
      const result = equipItem(state, entityId('sword_test'));
      expect(result.state.player.equipment.weapon).toBe('sword_test');
      expect(result.state.player.equipment.secondaryWeapon).toBeNull();
    });

    it('equips second weapon to secondary slot', () => {
      let result = equipItem(state, entityId('sword_test'));
      result = equipItem(result.state, entityId('axe_test'));

      expect(result.state.player.equipment.weapon).toBe('sword_test');
      expect(result.state.player.equipment.secondaryWeapon).toBe('axe_test');
    });

    it('replaces primary weapon when both slots full (FIFO)', () => {
      let result = equipItem(state, entityId('sword_test'));
      result = equipItem(result.state, entityId('axe_test'));
      result = equipItem(result.state, entityId('mace_test'));

      // New weapon should be primary, old primary should go to inventory
      expect(result.state.player.equipment.weapon).toBe('mace_test');
      expect(result.state.player.equipment.secondaryWeapon).toBe('axe_test');
      expect(result.state.player.inventory).toContain('sword_test');
    });
  });

  describe('ring FIFO', () => {
    it('equips first ring to ring1 slot', () => {
      const result = equipItem(state, entityId('ring_fire_test'));
      expect(result.state.player.equipment.ring1).toBe('ring_fire_test');
      expect(result.state.player.equipment.ring2).toBeNull();
    });

    it('equips second ring to ring2 slot', () => {
      let result = equipItem(state, entityId('ring_fire_test'));
      result = equipItem(result.state, entityId('ring_ice_test'));

      expect(result.state.player.equipment.ring1).toBe('ring_fire_test');
      expect(result.state.player.equipment.ring2).toBe('ring_ice_test');
    });

    it('replaces ring1 when both slots full (FIFO)', () => {
      let result = equipItem(state, entityId('ring_fire_test'));
      result = equipItem(result.state, entityId('ring_ice_test'));
      result = equipItem(result.state, entityId('ring_light_test'));

      // New ring should be in ring1, old ring1 should go to inventory
      expect(result.state.player.equipment.ring1).toBe('ring_light_test');
      expect(result.state.player.equipment.ring2).toBe('ring_ice_test');
      expect(result.state.player.inventory).toContain('ring_fire_test');
    });

    it('maintains FIFO order across multiple equips', () => {
      // Equip rings in sequence A, B, C, D
      let result = equipItem(state, entityId('ring_fire_test'));
      result = equipItem(result.state, entityId('ring_ice_test'));
      result = equipItem(result.state, entityId('ring_light_test'));

      // Current state: ring1=C, ring2=B, inventory has A
      expect(result.state.player.equipment.ring1).toBe('ring_light_test');
      expect(result.state.player.equipment.ring2).toBe('ring_ice_test');
      expect(result.state.player.inventory).toContain('ring_fire_test');
    });
  });
});
