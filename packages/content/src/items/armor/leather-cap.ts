import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const leatherCap: ArmorTemplate = {
  itemId: 'leather_cap',
  spriteName: 'elven leather helm',
  name: 'Leather Cap',
  description: 'A simple leather cap.',
  itemClass: 'armor',
  rarity: 'common',
  value: 8,
  stackable: false,
  maxStack: 1,
  armor: { defense: 1, evasionPenalty: 0, slot: 'head', ...slots('common') },
};
