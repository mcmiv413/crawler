import type { ObjectTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const arcaneAltar: ObjectTemplate = {
  templateId: 'arcane_altar',
  name: 'Arcane Altar',
  description: 'A crackling altar that rewards those who dare commune with it.',
  ascii: '*',
  color: '#aa44ff',
  sprite: SPRITE_MAP['object:arcane_altar'],
  healthDelta: -5,
  consumable: true,
  blocksMovement: false,
  lootTableId: 'loot_rare',
  biomes: [{ biomeId: 'frozen_depths' }, { biomeId: 'moss_caverns' }],
};
