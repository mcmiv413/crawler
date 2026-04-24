import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const emberCloak: ArmorTemplate = {
  itemId: 'ember_cloak',
  spriteName: 'dreadwyrm armor',
  name: 'Ember Cloak',
  description: 'A cloak that radiates heat and grants regeneration.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 95,
  stackable: false,
  maxStack: 1,
  armor: { defense: 5, evasionPenalty: 0, slot: 'chest', ...slots('rare', ['resist_fire', 'hp_regen']) },
};
