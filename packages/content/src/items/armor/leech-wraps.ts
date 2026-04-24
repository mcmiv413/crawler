import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const leechWraps: ArmorTemplate = {
  itemId: 'leech_wraps',
  spriteName: 'iron gauntlet',
  name: 'Leech Wraps',
  description: 'Mystical wraps that steal vitality from enemies.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 88,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 0, slot: 'gloves', ...slots('rare', ['life_steal']) },
};
