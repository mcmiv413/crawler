import type { TrapItemTemplate } from '@dungeon/contracts';
import { FROST_TRAP_RARITY } from '../../objects/frost-trap.js';

export const frostTrap: TrapItemTemplate = {
  itemId: 'frost_trap',
  name: 'Frost Trap',
  description: 'An icy trap that slows those who trigger it.',
  itemClass: 'trap',
  rarity: FROST_TRAP_RARITY,
  value: 30,
  stackable: true,
  maxStack: 3,
  trapTemplateId: 'frost_trap',
};
