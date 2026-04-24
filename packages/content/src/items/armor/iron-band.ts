import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const ironBand: ArmorTemplate = {
  itemId: 'iron_band',
  spriteName: 'copper ring',
  name: 'Iron Band',
  description: 'A sturdy iron ring that enhances defense.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 26,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('uncommon', ['defense_boost']) },
};
