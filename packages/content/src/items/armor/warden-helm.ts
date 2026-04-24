import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const wardenHelm: ArmorTemplate = {
  itemId: 'warden_helm',
  spriteName: 'crested helm',
  name: 'Warden Helm',
  description: 'A sturdy helmet that improves defense.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 35,
  stackable: false,
  maxStack: 1,
  armor: { defense: 5, evasionPenalty: 2, slot: 'head', ...slots('uncommon', ['defense_boost']) },
};
