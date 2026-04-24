import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const gripGauntlets: ArmorTemplate = {
  itemId: 'grip_gauntlets',
  spriteName: 'iron gauntlet',
  name: 'Grip Gauntlets',
  description: 'Reinforced gauntlets that improve defensive capabilities.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 32,
  stackable: false,
  maxStack: 1,
  armor: { defense: 4, evasionPenalty: 2, slot: 'gloves', ...slots('uncommon', ['defense_boost']) },
};
