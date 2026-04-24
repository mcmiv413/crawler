import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const boneGuardPlate: ArmorTemplate = {
  itemId: 'bone_guard_plate',
  spriteName: 'bronze armor',
  name: 'Bone Guard Plate',
  description: 'Heavy plate crafted from bone, with sharp edges.',
  itemClass: 'armor',
  rarity: 'epic',
  value: 150,
  stackable: false,
  maxStack: 1,
  armor: { defense: 12, evasionPenalty: 10, slot: 'chest', ...slots('epic', ['thorns', 'defense_boost']) },
};
