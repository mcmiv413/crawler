import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const leatherBoots: ArmorTemplate = {
  itemId: 'leather_boots',
  spriteName: 'leather boots',
  name: 'Leather Boots',
  description: 'Basic leather footwear.',
  itemClass: 'armor',
  rarity: 'common',
  value: 8,
  stackable: false,
  maxStack: 1,
  armor: { defense: 1, evasionPenalty: 0, slot: 'boots', ...slots('common') },
};
