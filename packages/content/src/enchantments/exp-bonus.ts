import type { EnchantmentDefinition } from '@dungeon/contracts';

export const expBonus = {
  id: 'exp_bonus',
  name: 'Experience Bonus',
  description: '+25% XP gain',
  tier: 3,
  effect: { type: 'exp_bonus', value: 0.25 },
} as const satisfies EnchantmentDefinition;
