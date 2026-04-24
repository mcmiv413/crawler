import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const emberRing: ArmorTemplate = {
  itemId: 'ember_ring',
  spriteName: 'copper ring',
  name: 'Ember Ring',
  description: 'A ring wreathed in flames, granting fire resistance.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 29,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('uncommon', ['resist_fire']) },
};
