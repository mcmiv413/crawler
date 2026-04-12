import type { ObjectTemplate } from '@dungeon/contracts';
import { SPRITE_MAP } from '../sprites/sprite-map.js';

export const trapSpikes: ObjectTemplate = {
  templateId: 'trap_spikes',
  name: 'Spike Trap',
  description: 'Pressure-plate spikes. Triggered when stepped on.',
  ascii: 'v',
  color: '#888',
  sprite: SPRITE_MAP['object:trap_spikes'],
  healthDelta: -15,
  consumable: false,
  blocksMovement: false,
  biomes: [{ biomeId: 'goblin_warrens' }, { biomeId: 'stone_crypt' }],
};
