import type { ObjectTemplate } from '@dungeon/contracts';

export const POISON_TRAP_RARITY = 'rare' as const;

export const poisonTrap: ObjectTemplate = {
  templateId: 'poison_trap',
  name: 'Poison Trap',
  description: 'A hidden trap that releases toxic gas when triggered.',
  ascii: 'p',
  color: '#00ff00',
  spriteName: 'acid pool center',
  healthDelta: -20,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  rarity: POISON_TRAP_RARITY,
  objectCategory: 'trap',
  statusEffect: 'poison',
  hazardType: 'poison',
};
