import type { TrapItemTemplate } from '@dungeon/contracts';
import { LIGHTNING_TRAP_RARITY } from '../../objects/lightning-trap.js';

export const lightningTrap: TrapItemTemplate = {
  itemId: 'lightning_trap',
  name: 'Lightning Trap',
  description: 'An electrical trap that stuns those who trigger it.',
  itemClass: 'trap',
  rarity: LIGHTNING_TRAP_RARITY,
  value: 60,
  stackable: true,
  maxStack: 2,
  trapTemplateId: 'lightning_trap',
  spriteName: 'lightning icon',
};
