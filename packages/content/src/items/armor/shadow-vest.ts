import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const shadowVest: ArmorTemplate = {
  itemId: 'shadow_vest',
  spriteName: 'mirror plate',
  name: 'Shadow Vest',
  description: 'A dark vest that enables brief moments of teleportation.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 100,
  stackable: false,
  maxStack: 1,
  armor: { defense: 4, evasionPenalty: 0, slot: 'chest', ...slots('rare', ['blink']) },
};
