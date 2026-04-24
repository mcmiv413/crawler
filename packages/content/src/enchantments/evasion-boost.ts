import type { EnchantmentDefinition } from '@dungeon/contracts';

export const evasionBoost = {
  id: 'evasion_boost',
  name: 'Evasion Boost',
  description: '+10 evasion',
  tier: 2,
  effect: { type: 'stat_bonus', stat: 'evasion', value: 10 },
} as const satisfies EnchantmentDefinition;
