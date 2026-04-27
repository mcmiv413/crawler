import type { TrapItemTemplate } from '@dungeon/contracts';
import { LIGHTNING_TRAP_RARITY } from '../../objects/lightning-trap.js';

export const thunderTrap: TrapItemTemplate = {
  itemId: 'thunder_trap',
  name: 'Thunder Trap',
  description: 'A powerful electrical trap that shocks the area.',
  itemClass: 'trap',
  rarity: LIGHTNING_TRAP_RARITY,
  value: 150,
  stackable: true,
  maxStack: 1,
  trapTemplateId: 'lightning_trap',
  spriteName: 'lightning icon',
};
