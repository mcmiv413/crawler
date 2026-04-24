import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const venomRing: ArmorTemplate = {
  itemId: 'venom_ring',
  spriteName: 'agate ring',
  name: 'Venom Ring',
  description: 'A ring that grants poison resistance.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 28,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('uncommon', ['resist_poison']) },
};
