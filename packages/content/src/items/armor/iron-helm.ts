import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const ironHelm: ArmorTemplate = {
  itemId: 'iron_helm',
  spriteName: 'dwarvish iron helm',
  name: 'Iron Helm',
  description: 'A solid iron helmet.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 28,
  stackable: false,
  maxStack: 1,
  armor: { defense: 4, evasionPenalty: 3, slot: 'head', ...slots('uncommon') },
};
