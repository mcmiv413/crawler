import type { EnchantmentDefinition } from '@dungeon/contracts';

export const thorns = {
  id: 'thorns',
  name: 'Thorns',
  description: 'Reflects 3 damage to attacker',
  tier: 1,
  effect: { type: 'thorns', value: 3 },
} as const satisfies EnchantmentDefinition;
