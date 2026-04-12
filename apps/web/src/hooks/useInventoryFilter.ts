import { useState } from 'react';
import type { InventoryItemView } from '@dungeon/presenter';

type FilterType = 'all' | 'weapons' | 'armor' | 'consumables';
type SortType = 'name' | 'rarity';

export function useInventoryFilter(items: readonly InventoryItemView[]): {
  filtered: InventoryItemView[];
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  sortBy: SortType;
  setSortBy: (s: SortType) => void;
} {
  const [filter, setFilter] = useState<FilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('name');

  // Filter items based on selected filter
  const filtered = items.filter(item => {
    if (filter === 'all') return true;
    if (filter === 'weapons') return item.itemClass === 'weapon';
    if (filter === 'armor') return item.itemClass === 'armor';
    return item.itemClass === 'consumable';
    return true;
  });

  // Sort filtered items
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      const rarityOrder: Record<string, number> = { 'common': 0, 'uncommon': 1, 'rare': 2, 'epic': 3, 'legendary': 4 };
      const rarityA = rarityOrder[a.rarity ?? ''] ?? -1;
      const rarityB = rarityOrder[b.rarity ?? ''] ?? -1;
      return rarityB - rarityA; // descending
    }
    return 0;
  });

  return { filtered: sorted, filter, setFilter, sortBy, setSortBy };
}
