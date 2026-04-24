import type { TrapItemTemplate } from '@dungeon/contracts';
import { FROST_TRAP_RARITY } from '../../objects/frost-trap.js';

export const absoluteZeroTrap: TrapItemTemplate = {
  itemId: 'absolute_zero_trap',
  name: 'Absolute Zero Trap',
  description: 'A trap of ultimate cold that completely immobilizes targets.',
  itemClass: 'trap',
  rarity: FROST_TRAP_RARITY,
  value: 150,
  stackable: true,
  maxStack: 1,
  trapTemplateId: 'frost_trap',
};
