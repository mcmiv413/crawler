import { ENCHANTMENT_BY_ID } from './index.js';

export const ENCHANTMENT_COSTS: Readonly<Record<1 | 2 | 3 | 'unique', number>> = {
  1: 40,
  2: 100,
  3: 200,
  unique: 150,
};

export function getEnchantmentCost(id: string): number {
  const ench = ENCHANTMENT_BY_ID.get(id);
  if (!ench) return 0;
  return ENCHANTMENT_COSTS[ench.tier as 1 | 2 | 3 | 'unique'];
}

export function getImpliedBlueprints(id: string): string[] {
  const ench = ENCHANTMENT_BY_ID.get(id);
  if (!ench) return [];
  return [id];
}
