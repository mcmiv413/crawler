import type { EnchantmentDefinition } from '@dungeon/contracts';

export const resistFire = {
  id: 'resist_fire',
  name: 'Fire Resistance',
  description: '30% fire damage reduction',
  tier: 1,
  effect: { type: 'resist', damageType: 'fire', value: 0.3 },
} as const satisfies EnchantmentDefinition;
