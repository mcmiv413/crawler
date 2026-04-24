import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const copperRing: ArmorTemplate = {
  itemId: 'copper_ring',
  spriteName: 'copper ring',
  name: 'Copper Ring',
  description: 'A plain copper ring, suitable for enchanting.',
  itemClass: 'armor',
  rarity: 'common',
  value: 10,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('common') },
};
