import type { ObjectTemplate } from '@dungeon/contracts';


export const arcaneAltar: ObjectTemplate = {
  templateId: 'arcane_altar',
  name: 'Arcane Altar',
  description: 'A crackling altar that rewards those who dare commune with it.',
  ascii: '*',
  color: '#aa44ff',
  spriteName: 'bloodied altar',
  healthDelta: 0,
  healthDeltaPercent: -50,
  consumable: true,
  blocksMovement: false,
  rarity: 'rare',
  objectCategory: 'misc',
  lootTableId: 'loot_rare',
};
