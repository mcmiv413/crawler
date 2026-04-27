import type { TrapItemTemplate } from '@dungeon/contracts';
import { TRAP_SPIKES_RARITY } from '../../objects/trap-spikes.js';

export const steelSpikeTrap: TrapItemTemplate = {
  itemId: 'steel_spike_trap',
  name: 'Steel Spike Trap',
  description: 'A finely crafted spike trap. Devastating to those who trigger it.',
  itemClass: 'trap',
  rarity: TRAP_SPIKES_RARITY,
  value: 60,
  stackable: true,
  maxStack: 2,
  trapTemplateId: 'trap_spikes',
  spriteName: 'spikes',
};
