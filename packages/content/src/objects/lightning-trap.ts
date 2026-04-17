import type { ObjectTemplate } from '@dungeon/contracts';

export const lightningTrap: ObjectTemplate = {
  templateId: 'lightning_trap',
  name: 'Lightning Trap',
  description: 'A charged mechanism that shocks those who trigger it.',
  ascii: 'l',
  color: '#ffff00',
  spriteName: 'electric tile',
  healthDelta: -30,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  statusEffect: 'stun',
  hazardType: 'lightning',
  biomes: [{ biomeId: 'stone_crypt' }],
};
