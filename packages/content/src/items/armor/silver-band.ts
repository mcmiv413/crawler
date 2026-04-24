import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const silverBand: ArmorTemplate = {
  itemId: 'silver_band',
  spriteName: 'agate ring',
  name: 'Silver Band',
  description: 'A silver ring with one enchantment slot.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 30,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('uncommon') },
};
