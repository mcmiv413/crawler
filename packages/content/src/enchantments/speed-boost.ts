import type { EnchantmentDefinition } from '@dungeon/contracts';

export const speedBoost = {
  id: 'speed_boost',
  name: 'Speed Boost',
  description: '+15 speed',
  tier: 2,
  effect: { type: 'stat_bonus', stat: 'speed', value: 15 },
} as const satisfies EnchantmentDefinition;
