import type { ObjectTemplate } from '@dungeon/contracts';

export const FROST_TRAP_RARITY = 'rare' as const;

export const frostTrap: ObjectTemplate = {
  templateId: 'frost_trap',
  name: 'Frost Trap',
  description: 'An icy mechanism that freezes those who trigger it.',
  ascii: 'f',
  color: '#00ffff',
  spriteName: 'ice icon',
  healthDelta: -20,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  rarity: FROST_TRAP_RARITY,
  objectCategory: 'trap',
  statusEffect: 'slow',
  hazardType: 'frost',
};
