import type { ObjectTemplate } from '@dungeon/contracts';

export const healingAltar: ObjectTemplate = {
  templateId: 'healing_altar',
  name: 'Healing Altar',
  description: 'A sacred altar radiating restorative energy. A risky communion grants profound healing.',
  ascii: '+',
  color: '#ffff44',
  spriteName: 'basin',
  healthDelta: 0,
  healthDeltaPercent: 75,
  consumable: true,
  blocksMovement: false,
  rarity: 'epic',
  objectCategory: 'healing',
};
