import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const spikedLeather: ArmorTemplate = {
  itemId: 'spiked_leather',
  spriteName: 'darkwyrm armor',
  name: 'Spiked Leather',
  description: 'Leather armor with sharp spikes protruding from the surface.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 45,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 0, slot: 'chest', ...slots('uncommon', ['thorns']) },
};
