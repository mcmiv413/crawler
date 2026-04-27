import type { TrapItemTemplate } from '@dungeon/contracts';
import { POISON_TRAP_RARITY } from '../../objects/poison-trap.js';

export const toxicTrap: TrapItemTemplate = {
  itemId: 'toxic_trap',
  name: 'Toxic Trap',
  description: 'A highly toxic trap that spreads poisonous fumes.',
  itemClass: 'trap',
  rarity: POISON_TRAP_RARITY,
  value: 60,
  stackable: true,
  maxStack: 2,
  trapTemplateId: 'poison_trap',
  spriteName: 'acid pool center',
};
