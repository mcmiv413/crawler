import type { ObjectTemplate } from '@dungeon/contracts';

export const chest: ObjectTemplate = {
  templateId: 'chest',
  name: 'Treasure Chest',
  description: 'A locked chest containing dungeon spoils.',
  ascii: '!',
  color: '#ff0',
  spriteName: 'closed big chest',
  healthDelta: 0,
  consumable: true,
  blocksMovement: false,
  objectCategory: 'chest',
  lootTableId: 'loot_chest',
};
