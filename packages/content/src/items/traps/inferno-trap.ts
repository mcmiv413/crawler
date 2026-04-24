import type { TrapItemTemplate } from '@dungeon/contracts';
import { FIRE_PIT_RARITY } from '../../objects/fire-pit.js';

export const infernoTrap: TrapItemTemplate = {
  itemId: 'inferno_trap',
  name: 'Inferno Trap',
  description: 'A powerful fire trap that burns with intense heat.',
  itemClass: 'trap',
  rarity: FIRE_PIT_RARITY,
  value: 30,
  stackable: true,
  maxStack: 3,
  trapTemplateId: 'fire_pit',
};
