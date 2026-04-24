import type { EnchantmentDefinition } from '@dungeon/contracts';

export const arcaneWard = {
  id: 'arcane_ward',
  name: 'Arcane Ward',
  description: '40% fire/shock/frost resistance',
  tier: 3,
  effect: { type: 'resist', value: 0.4 },
  resistAll: ['fire', 'shock', 'frost'] as const,
} as const satisfies EnchantmentDefinition;
