import type { EnchantmentDefinition } from '@dungeon/contracts';

export const defenseBoost = {
  id: 'defense_boost',
  name: 'Defense Boost',
  description: '+5 defense',
  tier: 2,
  effect: { type: 'stat_bonus', stat: 'defense', value: 5 },
} as const satisfies EnchantmentDefinition;
