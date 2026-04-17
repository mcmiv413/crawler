import type { ObjectTemplate } from '@dungeon/contracts';

export const infernoPit: ObjectTemplate = {
  templateId: 'inferno_pit',
  name: 'Inferno Pit',
  description: 'A raging inferno that incinerates those unfortunate enough to touch it.',
  ascii: '*',
  color: '#ff0000',
  spriteName: 'fire circle',
  healthDelta: -40,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  statusEffect: 'burn',
  hazardType: 'fire',
  biomes: [{ biomeId: 'goblin_warrens' }, { biomeId: 'stone_crypt' }],
};
