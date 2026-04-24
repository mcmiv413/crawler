import type { EnchantmentDefinition } from '@dungeon/contracts';

export const resistFrost = {
  id: 'resist_frost',
  name: 'Frost Resistance',
  description: '30% frost damage reduction',
  tier: 1,
  effect: { type: 'resist', damageType: 'frost', value: 0.3 },
} as const satisfies EnchantmentDefinition;
