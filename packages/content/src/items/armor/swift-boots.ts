import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const swiftBoots: ArmorTemplate = {
  itemId: 'swift_boots',
  spriteName: 'exquisite boots',
  name: 'Swift Boots',
  description: 'Enchanted boots that enhance movement speed.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 38,
  stackable: false,
  maxStack: 1,
  armor: { defense: 1, evasionPenalty: 0, slot: 'boots', ...slots('uncommon', ['speed_boost']) },
};
