import type { ObjectTemplate } from '@dungeon/contracts';

export const LIGHTNING_TRAP_RARITY = 'epic' as const;

export const lightningTrap: ObjectTemplate = {
  templateId: 'lightning_trap',
  name: 'Lightning Trap',
  description: 'A charged mechanism that shocks those who trigger it.',
  ascii: 'l',
  color: '#ffff00',
  spriteName: 'lightning icon',
  healthDelta: -30,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  rarity: LIGHTNING_TRAP_RARITY,
  objectCategory: 'trap',
  statusEffect: 'stun',
  hazardType: 'lightning',
};
