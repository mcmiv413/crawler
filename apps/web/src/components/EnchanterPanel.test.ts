import { describe, it, expect } from 'vitest';
import { ENCHANTMENT_BY_ID, getEnchantmentCost } from '@dungeon/content';

/**
 * TDD Test: Verify enchantment metadata should come from centralized source,
 * not hardcoded in React component.
 */
describe('EnchanterPanel enchantment data source', () => {
  it('all enchantments should have names defined in content', () => {
    for (const [enchId, enchDef] of ENCHANTMENT_BY_ID) {
      expect(enchDef.name).toBeDefined();
      expect(enchDef.name.length).toBeGreaterThan(0);
      // Verify T1, T2, T3, and unique tiers exist
      expect([1, 2, 3, 'unique']).toContain(enchDef.tier);
    }
  });

  it('all enchantments should have costs accessible from content', () => {
    for (const enchId of ENCHANTMENT_BY_ID.keys()) {
      const cost = getEnchantmentCost(enchId);
      // All enchantments should have a defined cost
      expect(cost).toBeGreaterThan(0);
    }
  });

  it('cost function should resolve tiers correctly', () => {
    // T1 should cost 40
    expect(getEnchantmentCost('hp_regen')).toBe(40);
    // T2 should cost 100
    expect(getEnchantmentCost('defense_boost')).toBe(100);
    // T3 should cost 200
    expect(getEnchantmentCost('exp_bonus')).toBe(200);
    // Unique should cost 150
    expect(getEnchantmentCost('blink')).toBe(150);
  });

  it('enchantment catalog has exactly 14 entries', () => {
    expect(ENCHANTMENT_BY_ID.size).toBe(14);
  });
});
