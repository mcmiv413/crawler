import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const chainShirt: ArmorTemplate = {
  itemId: 'chain_shirt',
  spriteName: 'chain shirt',
  name: 'Chain Shirt',
  description: 'Linked metal rings offering decent protection.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 35,
  stackable: false,
  maxStack: 1,
  armor: { defense: 5, evasionPenalty: 5, slot: 'chest', ...slots('uncommon') },
};
