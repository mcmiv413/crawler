import type { TrapItemTemplate } from '@dungeon/contracts';
import { POISON_TRAP_RARITY } from '../../objects/poison-trap.js';

export const lethalPoisonTrap: TrapItemTemplate = {
  itemId: 'lethal_poison_trap',
  name: 'Lethal Poison Trap',
  description: 'A deadly trap with concentrated venom.',
  itemClass: 'trap',
  rarity: POISON_TRAP_RARITY,
  value: 150,
  stackable: true,
  maxStack: 1,
  trapTemplateId: 'poison_trap',
  spriteName: 'acid pool center',
};
