/**
 * Test layer: unit
 * Behavior: getItemStats formats armor, weapon, ranged weapon, combined weapon-armor, and statless consumable summaries.
 * Proof: Assertions expect exact strings for zero defense, defense with evasion penalty, 8–8 and 6–10 physical damage, an empty consumable string, and combined fire damage plus armor text.
 * Validation: pnpm vitest run apps/web/src/utils/item-stats.test.ts
 */
import { describe, it, expect } from 'vitest';
import { getItemStats } from './item-stats.js';
import type { InventoryItemView } from '@dungeon/presenter';

describe('getItemStats', () => {
  const baseItem: InventoryItemView = {
    id: 'test-item',
    name: 'Test Item',
    description: 'Test',
    itemClass: 'armor',
    rarity: 'common',
    rarityColor: '#999',
    value: 100,
    sellPrice: 50,
    isEquipped: false,
    quantity: 1,
    stackEntityIds: ['test'],
    templateId: 'test',
  };

  it('returns "0 def" for armor with 0 defense', () => {
    const item: InventoryItemView = {
      ...baseItem,
      armorStats: {
        defense: 0,
        evasionPenalty: 0,
        slot: 'chest',
        enchantmentSlots: 2,
        enchantments: [null, null],
      },
    };

    const stats = getItemStats(item);
    expect(stats).toBe('0 def');
  });

  it('returns defense with evasion penalty', () => {
    const item: InventoryItemView = {
      ...baseItem,
      armorStats: {
        defense: 5,
        evasionPenalty: 2,
        slot: 'chest',
        enchantmentSlots: 2,
        enchantments: [null, null],
      },
    };

    const stats = getItemStats(item);
    expect(stats).toBe('5 def | eva penalty: -2');
  });

  it('returns weapon stats', () => {
    const item: InventoryItemView = {
      ...baseItem,
      itemClass: 'weapon',
      weaponStats: {
        damage: 8,
        damageMin: 8,
        damageMax: 8,
        damageType: 'physical',
        accuracy: 85,
        speed: 1,
        weaponRange: 1,
      },
    };

    const stats = getItemStats(item);
    expect(stats).toBe('8–8 physical dmg');
  });

  it('returns weapon stats with range', () => {
    const item: InventoryItemView = {
      ...baseItem,
      itemClass: 'weapon',
      weaponStats: {
        damage: 0,
        damageMin: 6,
        damageMax: 10,
        damageType: 'physical',
        accuracy: 80,
        speed: 1,
        weaponRange: 3,
      },
    };

    const stats = getItemStats(item);
    expect(stats).toBe('6–10 physical dmg | range: 3');
  });

  it('returns empty string for consumable with no stats', () => {
    const item: InventoryItemView = {
      ...baseItem,
      itemClass: 'consumable',
    };

    const stats = getItemStats(item);
    expect(stats).toBe('');
  });

  it('returns combined weapon and armor stats', () => {
    const item: InventoryItemView = {
      ...baseItem,
      weaponStats: {
        damage: 10,
        damageMin: 10,
        damageMax: 10,
        damageType: 'fire',
        accuracy: 90,
        speed: 1,
        weaponRange: 1,
      },
      armorStats: {
        defense: 3,
        evasionPenalty: 1,
        slot: 'chest',
        enchantmentSlots: 1,
        enchantments: [null],
      },
    };

    const stats = getItemStats(item);
    expect(stats).toBe('10–10 fire dmg3 def | eva penalty: -1');
  });
});
