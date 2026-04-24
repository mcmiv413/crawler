import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const regenVest: ArmorTemplate = {
  itemId: 'regen_vest',
  spriteName: 'brass armor',
  name: 'Regen Vest',
  description: 'A vest imbued with regenerative magic.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 90,
  stackable: false,
  maxStack: 1,
  armor: { defense: 8, evasionPenalty: 0, slot: 'chest', ...slots('rare', ['hp_regen']) },
};
