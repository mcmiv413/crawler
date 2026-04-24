import type { EnchantmentDefinition } from '@dungeon/contracts';

export const lifeSteal = {
  id: 'life_steal',
  name: 'Life Steal',
  description: '+2 HP on kill',
  tier: 3,
  effect: { type: 'life_steal', value: 2 },
} as const satisfies EnchantmentDefinition;
