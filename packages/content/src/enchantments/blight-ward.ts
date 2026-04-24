import type { EnchantmentDefinition } from '@dungeon/contracts';

export const blightWard = {
  id: 'blight_ward',
  name: 'Blight Ward',
  description: '50% poison/corruption reduction',
  tier: 2,
  effect: { type: 'resist', value: 0.5 },
  resistAll: ['poison', 'corruption'] as const,
} as const satisfies EnchantmentDefinition;
