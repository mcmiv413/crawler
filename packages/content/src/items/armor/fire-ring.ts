import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const fireRing: ArmorTemplate = {
  itemId: 'fire_ring',
  spriteName: 'ruby ring',
  name: 'Fire Ring',
  description: 'A smoldering ring that grants command over flame.',
  itemClass: 'armor',
  rarity: 'common',
  value: 20,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('common') },
};
