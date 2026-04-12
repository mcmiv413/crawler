import type { ObjectTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const healingFountain: ObjectTemplate = {
  templateId: 'healing_fountain',
  name: 'Healing Fountain',
  description: 'A blessed spring. Drinking from it restores vitality.',
  ascii: '~',
  color: '#44aaff',
  sprite: SPRITE_MAP['object:healing_fountain'],
  healthDelta: 25,
  consumable: true,
  blocksMovement: false,
  biomes: [{ biomeId: 'stone_crypt' }, { biomeId: 'moss_caverns' }],
};
