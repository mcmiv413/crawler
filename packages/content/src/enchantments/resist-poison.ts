import type { EnchantmentDefinition } from '@dungeon/contracts';

export const resistPoison = {
  id: 'resist_poison',
  name: 'Poison Resistance',
  description: '30% poison damage reduction',
  tier: 1,
  effect: { type: 'resist', damageType: 'poison', value: 0.3 },
} as const satisfies EnchantmentDefinition;
