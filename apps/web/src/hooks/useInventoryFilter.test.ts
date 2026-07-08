/**
 * Test layer: unit
 * Behavior: Inventory filtering helpers and useInventoryFilter apply item class filters and rarity/name sorting to produce deterministic displayed item order.
 * Proof: Asserts filtered item-name arrays for all, weapons, armor, and consumables; rarity order Epic/Rare/Common/unknown; alphabetical rare ties; and hook output after setFilter/setSortBy.
 * Validation: pnpm vitest run apps/web/src/hooks/useInventoryFilter.test.ts
 */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { InventoryItemView } from '@dungeon/presenter';
import {
  filterInventoryItems,
  sortInventoryItems,
  useInventoryFilter,
} from './useInventoryFilter.js';

function item(
  id: string,
  name: string,
  itemClass: string,
  rarity: string,
): InventoryItemView {
  return {
    id,
    name,
    description: `${name} description`,
    itemClass,
    rarity,
    rarityColor: '#888888',
    value: 10,
    sellPrice: 5,
    isEquipped: false,
    quantity: 1,
    stackEntityIds: [id],
    templateId: id,
  };
}

const items = [
  item('rare_sword', 'Rare Sword', 'weapon', 'rare'),
  item('common_armor', 'Common Armor', 'armor', 'common'),
  item('odd_potion', 'Odd Potion', 'consumable', 'artifact'),
  item('epic_axe', 'Epic Axe', 'weapon', 'epic'),
];

describe('inventory filtering helpers', () => {
  it('filters by supported item classes', () => {
    expect(filterInventoryItems(items, 'all').map(entry => entry.name)).toEqual([
      'Rare Sword',
      'Common Armor',
      'Odd Potion',
      'Epic Axe',
    ]);
    expect(filterInventoryItems(items, 'weapons').map(entry => entry.name)).toEqual([
      'Rare Sword',
      'Epic Axe',
    ]);
    expect(filterInventoryItems(items, 'armor').map(entry => entry.name)).toEqual(['Common Armor']);
    expect(filterInventoryItems(items, 'consumables').map(entry => entry.name)).toEqual(['Odd Potion']);
  });

  it('sorts known rarities descending and keeps unknown rarities last', () => {
    expect(sortInventoryItems(items, 'rarity').map(entry => entry.name)).toEqual([
      'Epic Axe',
      'Rare Sword',
      'Common Armor',
      'Odd Potion',
    ]);
  });

  it('sorts rarity ties by name for deterministic display order', () => {
    const tiedItems = [
      item('zeta', 'Zeta Charm', 'armor', 'rare'),
      item('alpha', 'Alpha Charm', 'armor', 'rare'),
    ];

    expect(sortInventoryItems(tiedItems, 'rarity').map(entry => entry.name)).toEqual([
      'Alpha Charm',
      'Zeta Charm',
    ]);
  });
});

describe('useInventoryFilter', () => {
  it('applies the selected filter and sort state', () => {
    const { result } = renderHook(() => useInventoryFilter(items));

    act(() => {
      result.current.setFilter('weapons');
      result.current.setSortBy('rarity');
    });

    expect(result.current.filtered.map(entry => entry.name)).toEqual([
      'Epic Axe',
      'Rare Sword',
    ]);
  });
});
