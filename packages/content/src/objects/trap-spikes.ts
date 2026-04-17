import type { ObjectTemplate } from '@dungeon/contracts';

export const TRAP_SPIKES_RARITY = 'uncommon' as const;

export const trapSpikes: ObjectTemplate = {
  templateId: 'trap_spikes',
  name: 'Spike Trap',
  description: 'Pressure-plate spikes. Triggered when stepped on.',
  ascii: 'v',
  color: '#888',
  spriteName: 'spikes',
  healthDelta: -15,
  consumable: false,
  blocksMovement: false,
  isHazard: true,
  rarity: TRAP_SPIKES_RARITY,
  objectCategory: 'trap',
  statusEffect: 'bleed',
  hazardType: 'spike',
};
