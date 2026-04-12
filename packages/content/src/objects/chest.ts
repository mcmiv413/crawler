import type { ObjectTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const chest: ObjectTemplate = {
  templateId: 'chest',
  name: 'Treasure Chest',
  description: 'A locked chest containing dungeon spoils.',
  ascii: '!',
  color: '#ff0',
  sprite: SPRITE_MAP['object:chest'],
  healthDelta: 0,
  consumable: true,
  blocksMovement: false,
  lootTableId: 'loot_chest',
  biomes: [
    { biomeId: 'stone_crypt' },
    { biomeId: 'goblin_warrens' },
    { biomeId: 'moss_caverns' },
    { biomeId: 'frozen_depths' },
  ],
};
