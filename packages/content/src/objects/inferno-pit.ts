import type { ObjectTemplate } from '@dungeon/contracts';

export const INFERNO_PIT_RARITY = 'legendary' as const;

export const infernoPit: ObjectTemplate = {
  templateId: 'inferno_pit',
  name: 'Inferno Pit',
  description: 'A raging inferno that incinerates those unfortunate enough to touch it.',
  ascii: '*',
  color: '#ff0000',
  spriteName: 'big flame',
  healthDelta: -40,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  rarity: INFERNO_PIT_RARITY,
  objectCategory: 'trap',
  statusEffect: 'burn',
  hazardType: 'fire',
};
