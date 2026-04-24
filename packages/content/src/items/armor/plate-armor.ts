import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const plateArmor: ArmorTemplate = {
  itemId: 'plate_armor',
  spriteName: 'full plate',
  name: 'Plate Armor',
  description: 'Heavy metal plates. Excellent defense, poor mobility.',
  itemClass: 'armor',
  rarity: 'rare',
  value: 70,
  stackable: false,
  maxStack: 1,
  armor: { defense: 10, evasionPenalty: 15, slot: 'chest', ...slots('rare') },
};
