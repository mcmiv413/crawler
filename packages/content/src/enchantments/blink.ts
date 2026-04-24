import type { EnchantmentDefinition } from '@dungeon/contracts';

export const blink = {
  id: 'blink',
  name: 'Blink',
  description: '30% chance to teleport on hit (avoid damage)',
  tier: 'unique',
  effect: { type: 'blink', value: 0.3 },
} as const satisfies EnchantmentDefinition;
