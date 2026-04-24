import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const shadowRing: ArmorTemplate = {
  itemId: 'shadow_ring',
  spriteName: 'agate ring',
  name: 'Shadow Ring',
  description: 'A dark ring that enables evasion and teleportation.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 85,
  stackable: false,
  maxStack: 1,
  armor: { defense: 0, evasionPenalty: 0, slot: 'ring', ...slots('rare', ['blink', 'evasion_boost']) },
};
