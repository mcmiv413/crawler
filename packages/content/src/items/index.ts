import type { AnyItemTemplate } from '@dungeon/contracts';
import { WEAPONS } from './weapons.js';
import { ARMOR } from './armor.js';
import { CONSUMABLES } from './consumables.js';

export const ALL_ITEMS: readonly AnyItemTemplate[] = [
  ...WEAPONS,
  ...ARMOR,
  ...CONSUMABLES,
];

export const ITEM_BY_ID: ReadonlyMap<string, AnyItemTemplate> = new Map(
  ALL_ITEMS.map(item => [item.itemId, item])
);

export { WEAPONS, ARMOR, CONSUMABLES };
