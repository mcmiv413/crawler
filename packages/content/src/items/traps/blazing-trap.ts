import type { TrapItemTemplate } from '@dungeon/contracts';
import { INFERNO_PIT_RARITY } from '../../objects/inferno-pit.js';

export const blazingTrap: TrapItemTemplate = {
  itemId: 'blazing_trap',
  name: 'Blazing Trap',
  description: 'An infernal trap that engulfs targets in flames.',
  itemClass: 'trap',
  rarity: INFERNO_PIT_RARITY,
  value: 60,
  stackable: true,
  maxStack: 2,
  trapTemplateId: 'fire_pit',
  spriteName: 'fire icon',
};
