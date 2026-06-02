import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const lightningRing: ArmorTemplate = {
  itemId: 'lightning_ring',
  spriteName: 'sapphire ring',
  name: 'Lightning Ring',
  description: 'A crackling ring that grants command over lightning.',
  itemClass: 'armor',
  rarity: 'common',
  value: 20,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('common') },
};
