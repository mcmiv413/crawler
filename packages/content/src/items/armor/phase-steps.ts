import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const phaseSteps: ArmorTemplate = {
  itemId: 'phase_steps',
  spriteName: 'exquisite boots',
  name: 'Phase Steps',
  description: 'Boots that allow brief teleportation and enhanced evasion.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 98,
  stackable: false,
  maxStack: 1,
  armor: { defense: 2, evasionPenalty: 0, slot: 'boots', ...slots('rare', ['blink', 'evasion_boost']) },
};
