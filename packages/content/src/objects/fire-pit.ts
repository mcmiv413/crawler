import type { ObjectTemplate } from '@dungeon/contracts';

export const firePit: ObjectTemplate = {
  templateId: 'fire_pit',
  name: 'Fire Pit',
  description: 'A pit of burning coals. Stepping near it scorches.',
  ascii: '^',
  color: '#ff4400',
  spriteName: 'brass lantern',
  healthDelta: -10,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  statusEffect: 'burn',
  hazardType: 'fire',
  biomes: [{ biomeId: 'goblin_warrens' }],
};
