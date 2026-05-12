import type { EnchantmentDefinition } from '@dungeon/contracts';
import { FIRE_RING_EMBER_ID } from '../abilities/utilities.js';

export const fireRingEmber = {
  id: 'fire_ring_ember',
  name: 'Ember Binding',
  description: 'Grants the Ember spell while the item is equipped.',
  tier: 'unique',
  effect: { type: 'grant_ability', abilityId: FIRE_RING_EMBER_ID },
} as const satisfies EnchantmentDefinition;
