import type { ObjectTemplate } from '@dungeon/contracts';

export const chest: ObjectTemplate = {
  templateId: 'chest',
  name: 'Treasure Chest',
  description: 'A locked chest containing dungeon spoils.',
  ascii: '!',
  color: '#ff0',
  spriteName: 'closed chest',
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
