/**
 * Test layer: unit
 * Behavior: Index covers enchantment catalog; all enchantments are in ENCHANTMENT_BY_ID map; map size matches data array.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/content/src/enchantments/index.test.ts
 */
import { describe, it, expect } from 'vitest';
import {
  ENCHANTMENTS,
  ENCHANTMENT_BY_ID,
  getEnchantmentCost,
  getImpliedBlueprints,
  ENCHANTMENT_COSTS,
} from './index.js';

describe('enchantment catalog', () => {
  it('all enchantments are in ENCHANTMENT_BY_ID map', () => {
    for (const ench of ENCHANTMENTS) {
      expect(ENCHANTMENT_BY_ID.has(ench.id), `missing ${ench.id}`).toBe(true);
    }
  });

  it('map size matches data array', () => {
    expect(ENCHANTMENT_BY_ID.size).toBe(ENCHANTMENTS.length);
  });

  it('tier assignments are correct', () => {
    const byTier = {
      1: ENCHANTMENTS.filter(e => e.tier === 1),
      2: ENCHANTMENTS.filter(e => e.tier === 2),
      3: ENCHANTMENTS.filter(e => e.tier === 3),
      unique: ENCHANTMENTS.filter(e => e.tier === 'unique'),
    };

    expect(byTier[1].length).toBeGreaterThan(0);
    expect(byTier[2].length).toBeGreaterThan(0);
    expect(byTier[3].length).toBeGreaterThan(0);
    expect(byTier.unique.length).toBeGreaterThan(0);

    for (const ench of ENCHANTMENTS) {
      const retrieved = ENCHANTMENT_BY_ID.get(ench.id)!;
      expect(retrieved.tier).toBe(ench.tier);
    }
  });
});

describe('getEnchantmentCost', () => {
  it('returns the cost matching the enchantment tier for every catalog entry', () => {
    for (const ench of ENCHANTMENTS) {
      const expected = ENCHANTMENT_COSTS[ench.tier];
      expect(
        getEnchantmentCost(ench.id),
        `${ench.id} (tier ${String(ench.tier)}) cost mismatch`,
      ).toBe(expected);
    }
  });

  it('tier costs stay positive and increase across the standard tiers', () => {
    expect(ENCHANTMENT_COSTS[1]).toBeGreaterThan(0);
    expect(ENCHANTMENT_COSTS[2]).toBeGreaterThan(ENCHANTMENT_COSTS[1]);
    expect(ENCHANTMENT_COSTS[3]).toBeGreaterThan(ENCHANTMENT_COSTS[2]);
    expect(ENCHANTMENT_COSTS.unique).toBeGreaterThan(0);
  });

  it('returns 0 for unknown enchantment', () => {
    expect(getEnchantmentCost('nonexistent')).toBe(0);
  });
});

describe('getImpliedBlueprints', () => {
  it('every known enchantment implies only itself', () => {
    for (const ench of ENCHANTMENTS) {
      const implied = getImpliedBlueprints(ench.id);
      expect(implied, `${ench.id} should imply itself`).toContain(ench.id);
      expect(implied.length, `${ench.id} should imply exactly one blueprint`).toBe(1);
    }
  });

  it('returns empty array for unknown enchantment', () => {
    expect(getImpliedBlueprints('unknown')).toEqual([]);
  });
});
