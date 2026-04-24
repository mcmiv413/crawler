import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const leatherVest: ArmorTemplate = {
  itemId: 'leather_vest',
  spriteName: 'scale armor',
  name: 'Leather Vest',
  description: 'Basic leather protection.',
  itemClass: 'armor',
  rarity: 'common',
  value: 12,
  stackable: false,
  maxStack: 1,
  armor: { defense: 2, evasionPenalty: 0, slot: 'chest', ...slots('common') },
};
