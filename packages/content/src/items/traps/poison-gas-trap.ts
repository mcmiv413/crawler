import type { TrapItemTemplate } from '@dungeon/contracts';
import { POISON_TRAP_RARITY } from '../../objects/poison-trap.js';

export const poisonGasTrap: TrapItemTemplate = {
  itemId: 'poison_gas_trap',
  name: 'Poison Gas Trap',
  description: 'Releases toxic gas. Poisons those who trigger it.',
  itemClass: 'trap',
  rarity: POISON_TRAP_RARITY,
  value: 30,
  stackable: true,
  maxStack: 3,
  trapTemplateId: 'poison_trap',
};
