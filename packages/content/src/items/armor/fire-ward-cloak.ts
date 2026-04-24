import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const fireWardCloak: ArmorTemplate = {
  itemId: 'fire_ward_cloak',
  spriteName: 'bogwyrm armor',
  name: 'Fire Ward Cloak',
  description: 'A cloak woven with fire-resistant fibers.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 40,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 0, slot: 'chest', resistance: { fire: 0.3 }, ...slots('uncommon') },
};
