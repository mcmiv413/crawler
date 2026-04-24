import type { EnchantmentDefinition } from '@dungeon/contracts';

export const hpRegen = {
  id: 'hp_regen',
  name: 'HP Regeneration',
  description: '+2 HP per turn',
  tier: 1,
  effect: { type: 'regen', value: 2 },
} as const satisfies EnchantmentDefinition;
