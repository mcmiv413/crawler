import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const leatherGloves: ArmorTemplate = {
  itemId: 'leather_gloves',
  spriteName: 'leather glove',
  name: 'Leather Gloves',
  description: 'Simple leather hand protection.',
  itemClass: 'armor',
  rarity: 'common',
  value: 7,
  stackable: false,
  maxStack: 1,
  armor: { defense: 1, evasionPenalty: 0, slot: 'gloves', ...slots('common') },
};
