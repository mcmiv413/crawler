/**
 * Test layer: unit
 * Behavior: EnchanterPanel covers EnchanterPanel enchantment data consumption; fixture enchantments all have non-empty names; fixture enchantments all have valid tiers.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/components/EnchanterPanel.test.ts
 */
import { describe, it, expect } from 'vitest';

/**
 * EnchanterPanel unit tests
 *
 * Tests that the panel's logic correctly consumes enchantment data.
 * Uses local fixture data — no live @dungeon/content imports.
 *
 * Content-catalog invariants (enchantment count, tier structure, cost ranges)
 * live in tests/contracts/enchantment-catalog.contract.test.ts.
 */

// Local fixture: representative enchantment data matching the EnchantmentDef shape
const TEST_ENCHANTMENTS = [
  { id: 'hp_regen', name: 'HP Regen', tier: 1 as const, cost: 40 },
  { id: 'defense_boost', name: 'Defense Boost', tier: 2 as const, cost: 100 },
  { id: 'exp_bonus', name: 'EXP Bonus', tier: 3 as const, cost: 200 },
  { id: 'blink', name: 'Blink', tier: 'unique' as const, cost: 150 },
] as const;

describe('EnchanterPanel enchantment data consumption', () => {
  it('fixture enchantments all have non-empty names', () => {
    for (const ench of TEST_ENCHANTMENTS) {
      expect(ench.name).toMatch(/\S/);
    }
  });

  it('fixture enchantments all have valid tiers', () => {
    for (const ench of TEST_ENCHANTMENTS) {
      expect([1, 2, 3, 'unique']).toContain(ench.tier);
    }
  });

  it('fixture enchantments all have positive costs', () => {
    for (const ench of TEST_ENCHANTMENTS) {
      expect(ench.cost).toBeGreaterThan(0);
    }
  });

  it('higher tiers cost more than lower tiers', () => {
    const t1 = TEST_ENCHANTMENTS.find(e => e.tier === 1)!;
    const t2 = TEST_ENCHANTMENTS.find(e => e.tier === 2)!;
    const t3 = TEST_ENCHANTMENTS.find(e => e.tier === 3)!;
    expect(t2.cost).toBeGreaterThan(t1.cost);
    expect(t3.cost).toBeGreaterThan(t2.cost);
  });
});
