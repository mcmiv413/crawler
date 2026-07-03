import { useState } from 'react';
import type { InventoryItemView } from '@dungeon/presenter';

export type InventoryFilterType = 'all' | 'weapons' | 'armor' | 'consumables';
export type InventorySortType = 'name' | 'rarity';

export const INVENTORY_FILTER_OPTIONS: ReadonlyArray<{ value: InventoryFilterType; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'weapons', label: 'Weapons' },
  { value: 'armor', label: 'Armor' },
  { value: 'consumables', label: 'Consumables' },
];

export const INVENTORY_SORT_OPTIONS: ReadonlyArray<{ value: InventorySortType; label: string }> = [
  { value: 'name', label: 'Name' },
  { value: 'rarity', label: 'Rarity' },
];

const RARITY_ORDER: Readonly<Record<string, number>> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
};

interface FilterableItem {
  readonly itemClass: string;
  readonly name: string;
  readonly rarity: string;
}

export function filterInventoryItems<T extends FilterableItem>(
  items: readonly T[],
  filter: InventoryFilterType,
): T[] {
  return items.filter(item => {
    switch (filter) {
      case 'all':
        return true;
      case 'weapons':
        return item.itemClass === 'weapon';
      case 'armor':
        return item.itemClass === 'armor';
      case 'consumables':
        return item.itemClass === 'consumable';
    }

    const exhaustiveFilter: never = filter;
    return exhaustiveFilter;
  });
}

export function sortInventoryItems<T extends FilterableItem>(
  items: readonly T[],
  sortBy: InventorySortType,
): T[] {
  return [...items].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }

    const rarityA = RARITY_ORDER[a.rarity] ?? -1;
    const rarityB = RARITY_ORDER[b.rarity] ?? -1;
    const rarityDelta = rarityB - rarityA;
    return rarityDelta === 0 ? a.name.localeCompare(b.name) : rarityDelta;
  });
}

export function useInventoryFilter(items: readonly InventoryItemView[]): {
  filtered: InventoryItemView[];
  filter: InventoryFilterType;
  setFilter: (f: InventoryFilterType) => void;
  sortBy: InventorySortType;
  setSortBy: (s: InventorySortType) => void;
} {
  const [filter, setFilter] = useState<InventoryFilterType>('all');
  const [sortBy, setSortBy] = useState<InventorySortType>('name');

  const filtered = filterInventoryItems(items, filter);
  const sorted = sortInventoryItems(filtered, sortBy);

  return { filtered: sorted, filter, setFilter, sortBy, setSortBy };
}
