import type { ObjectTemplate } from '@dungeon/contracts';

export const trapSpikes: ObjectTemplate = {
  templateId: 'trap_spikes',
  name: 'Spike Trap',
  description: 'Pressure-plate spikes. Triggered when stepped on.',
  ascii: 'v',
  color: '#888',
  spriteName: 'spiked pit tile',
  healthDelta: -15,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  statusEffect: 'bleed',
  hazardType: 'spike',
  biomes: [{ biomeId: 'goblin_warrens' }, { biomeId: 'stone_crypt' }],
};
