import type { TrapItemTemplate } from '@dungeon/contracts';
import { FROST_TRAP_RARITY } from '../../objects/frost-trap.js';

export const frozenTrap: TrapItemTemplate = {
  itemId: 'frozen_trap',
  name: 'Frozen Trap',
  description: 'A powerful frost trap that freezes targets.',
  itemClass: 'trap',
  rarity: FROST_TRAP_RARITY,
  value: 60,
  stackable: true,
  maxStack: 2,
  trapTemplateId: 'frost_trap',
  spriteName: 'ice icon',
};
