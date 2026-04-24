import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const blessedRing: ArmorTemplate = {
  itemId: 'blessed_ring',
  spriteName: 'agate ring',
  name: 'Blessed Ring',
  description: 'A holy ring that grants slow regeneration.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 72,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('rare', ['hp_regen']) },
};
