import type { TrapItemTemplate } from '@dungeon/contracts';

export const ironSpikeTrap: TrapItemTemplate = {
  itemId: 'iron_spike_trap',
  name: 'Iron Spike Trap',
  description: 'A reinforced spike trap. Deals more damage and causes bleeding.',
  itemClass: 'trap',
  rarity: 'uncommon',
  value: 30,
  stackable: true,
  maxStack: 3,
  trapTemplateId: 'trap_spikes',
};
