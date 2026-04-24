import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const ironCrown: ArmorTemplate = {
  itemId: 'iron_crown',
  spriteName: 'etched helm',
  name: 'Iron Crown',
  description: 'A regal crown of pure iron with enhanced defenses.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 85,
  stackable: false,
  maxStack: 1,
  armor: { defense: 7, evasionPenalty: 4, slot: 'head', ...slots('rare', ['defense_boost']) },
};
