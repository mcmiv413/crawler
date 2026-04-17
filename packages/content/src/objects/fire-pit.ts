import type { ObjectTemplate } from '@dungeon/contracts';

export const FIRE_PIT_RARITY = 'common' as const;

export const firePit: ObjectTemplate = {
  templateId: 'fire_pit',
  name: 'Fire Pit',
  description: 'A pit of burning coals. Stepping near it scorches.',
  ascii: '^',
  color: '#ff4400',
  spriteName: 'fire icon',
  healthDelta: -10,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  rarity: FIRE_PIT_RARITY,
  objectCategory: 'trap',
  statusEffect: 'burn',
  hazardType: 'fire',
};
