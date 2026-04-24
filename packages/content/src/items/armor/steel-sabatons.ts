import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const steelSabatons: ArmorTemplate = {
  itemId: 'steel_sabatons',
  spriteName: 'exquisite boots',
  name: 'Steel Sabatons',
  description: 'Heavy steel foot armor.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 55,
  stackable: false,
  maxStack: 1,
  armor: { defense: 5, evasionPenalty: 5, slot: 'boots', ...slots('rare') },
};
