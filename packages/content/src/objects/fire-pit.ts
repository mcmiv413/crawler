import type { ObjectTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const firePit: ObjectTemplate = {
  templateId: 'fire_pit',
  name: 'Fire Pit',
  description: 'A pit of burning coals. Stepping near it scorches.',
  ascii: '^',
  color: '#ff4400',
  sprite: SPRITE_MAP['object:fire_pit'],
  healthDelta: -10,
  consumable: false,
  blocksMovement: false,
  biomes: [{ biomeId: 'goblin_warrens' }],
};
