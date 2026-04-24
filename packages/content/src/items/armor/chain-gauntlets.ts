import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const chainGauntlets: ArmorTemplate = {
  itemId: 'chain_gauntlets',
  spriteName: 'iron gauntlet',
  name: 'Chain Gauntlets',
  description: 'Mail gauntlets for solid hand defense.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 22,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 2, slot: 'gloves', ...slots('uncommon') },
};
