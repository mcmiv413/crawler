import type { EnchantmentDefinition } from '@dungeon/contracts';

export const spikes = {
  id: 'spikes',
  name: 'Spikes',
  description: 'Reflects 6 damage to attacker',
  tier: 2,
  effect: { type: 'thorns', value: 6 },
} as const satisfies EnchantmentDefinition;
