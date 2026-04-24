import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const mindVeil: ArmorTemplate = {
  itemId: 'mind_veil',
  spriteName: 'helmet',
  name: 'Mind Veil',
  description: 'A mystical veil that protects against magical ailments.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 90,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 0, slot: 'head', ...slots('rare', ['blight_ward']) },
};
