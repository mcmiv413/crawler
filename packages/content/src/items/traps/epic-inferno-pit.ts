import type { TrapItemTemplate } from '@dungeon/contracts';
import { INFERNO_PIT_RARITY } from '../../objects/inferno-pit.js';

export const epicInfernoPit: TrapItemTemplate = {
  itemId: 'epic_inferno_pit',
  name: 'Epic Inferno Pit',
  description: 'The ultimate fire trap. Immense heat and flames consume all.',
  itemClass: 'trap',
  rarity: INFERNO_PIT_RARITY,
  value: 150,
  stackable: true,
  maxStack: 1,
  trapTemplateId: 'inferno_pit',
  spriteName: 'big flame',
};
