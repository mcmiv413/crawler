import { ENCHANTMENT_SLOTS_BY_RARITY } from '../../balance/tables.js';

export function slots(rarity: string, enchantments: (string | null)[] = []): { enchantmentSlots: number; enchantments: readonly (string | null)[] } {
  const count = ENCHANTMENT_SLOTS_BY_RARITY[rarity] ?? 0;
  const nulls = Array.from({ length: Math.max(0, count - enchantments.length) }, () => null);
  return { enchantmentSlots: count, enchantments: [...enchantments, ...nulls] };
}
