import type { TrapItemTemplate } from '@dungeon/contracts';
import { TRAP_SPIKES_RARITY } from '../../objects/trap-spikes.js';

export const woodenSpikeTrap: TrapItemTemplate = {
  itemId: 'wooden_spike_trap',
  name: 'Wooden Spike Trap',
  description: 'A simple spike trap. Causes bleeding when triggered.',
  itemClass: 'trap',
  rarity: TRAP_SPIKES_RARITY,
  value: 15,
  stackable: true,
  maxStack: 5,
  trapTemplateId: 'trap_spikes',
};
