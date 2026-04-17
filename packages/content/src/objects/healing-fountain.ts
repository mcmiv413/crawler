import type { ObjectTemplate } from '@dungeon/contracts';


export const healingFountain: ObjectTemplate = {
  templateId: 'healing_fountain',
  name: 'Healing Fountain',
  description: 'A blessed spring. Drinking from it restores vitality.',
  ascii: '~',
  color: '#44aaff',
  spriteName: 'fountain',
  healthDelta: 0,
  healthDeltaPercent: 20,
  consumable: true,
  blocksMovement: false,
  biomes: [{ biomeId: 'stone_crypt' }, { biomeId: 'moss_caverns' }],
};
