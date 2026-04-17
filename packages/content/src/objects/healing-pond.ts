import type { ObjectTemplate } from '@dungeon/contracts';

export const healingPond: ObjectTemplate = {
  templateId: 'healing_pond',
  name: 'Healing Pond',
  description: 'Clear water that gently restores health when touched.',
  ascii: '~',
  color: '#2288ff',
  spriteName: 'blue puddle',
  healthDelta: 0,
  healthDeltaPercent: 10,
  consumable: true,
  blocksMovement: false,
  rarity: 'common',
  objectCategory: 'healing',
};
