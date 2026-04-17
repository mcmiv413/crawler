import type { ObjectTemplate } from '@dungeon/contracts';

export const frostTrap: ObjectTemplate = {
  templateId: 'frost_trap',
  name: 'Frost Trap',
  description: 'An icy mechanism that freezes those who trigger it.',
  ascii: 'f',
  color: '#00ffff',
  spriteName: 'ice tile',
  healthDelta: -20,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  statusEffect: 'slow',
  hazardType: 'frost',
  biomes: [{ biomeId: 'stone_crypt' }],
};
