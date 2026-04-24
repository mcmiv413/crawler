import type { ArmorTemplate } from '@dungeon/contracts';
import { slots } from './utils.js';

export const plagueMantle: ArmorTemplate = {
  itemId: 'plague_mantle',
  spriteName: 'scale armor',
  name: 'Plague Mantle',
  description: 'A tattered mantle that grants poison resistance.',
  itemClass: 'armor',
  rarity: 'uncommon',
  value: 40,
  stackable: false,
  maxStack: 1,
  armor: { defense: 3, evasionPenalty: 0, slot: 'chest', ...slots('uncommon', ['blight_ward']) },
};
