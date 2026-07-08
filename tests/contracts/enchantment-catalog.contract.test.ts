/**
 * Test layer: contract
 * Behavior: Enchantment Catalog covers Enchantment Catalog Contract; all enchantments have non-empty names defined in content; all enchantments have valid tiers.
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run tests/contracts/enchantment-catalog.contract.test.ts
 */
import { describe, it, expect } from 'vitest';
import { ENCHANTMENT_BY_ID, getEnchantmentCost } from '@dungeon/content';

/**
 * Contract Tests: Enchantment Catalog Integrity
 *
 * Validates that the live enchantment registry has the expected structure,
 * tiers, and cost resolution. These are contract (not unit) tests because
 * they validate live exported content data.
 *
 * Moved from apps/web/src/components/EnchanterPanel.test.ts.
 */
describe('Enchantment Catalog Contract', () => {
  it('all enchantments have non-empty names defined in content', () => {
    for (const [enchId, enchDef] of ENCHANTMENT_BY_ID) {
      expect(enchDef.name, `enchantment ${enchId} has empty name`).toMatch(/\S/);
    }
  });

  it('all enchantments have valid tiers', () => {
    for (const [enchId, enchDef] of ENCHANTMENT_BY_ID) {
      expect(
        [1, 2, 3, 'unique'],
        `enchantment ${enchId} has invalid tier ${enchDef.tier}`,
      ).toContain(enchDef.tier);
    }
  });

  it('all enchantments have a positive cost resolvable from content', () => {
    for (const enchId of ENCHANTMENT_BY_ID.keys()) {
      const cost = getEnchantmentCost(enchId);
      expect(cost, `enchantment ${enchId} cost is not positive`).toBeGreaterThan(0);
    }
  });

  it('enchantment catalog is non-empty', () => {
    expect(ENCHANTMENT_BY_ID.size).toBeGreaterThan(0);
  });

  it('cost function resolves tier costs in ascending order (T1 < T2 < T3)', () => {
    // Find one enchantment per tier and confirm cost ordering
    const t1 = [...ENCHANTMENT_BY_ID.values()].find(e => e.tier === 1);
    const t2 = [...ENCHANTMENT_BY_ID.values()].find(e => e.tier === 2);
    const t3 = [...ENCHANTMENT_BY_ID.values()].find(e => e.tier === 3);

    if (t1 && t2) expect(getEnchantmentCost(t2.id)).toBeGreaterThan(getEnchantmentCost(t1.id));
    if (t2 && t3) expect(getEnchantmentCost(t3.id)).toBeGreaterThan(getEnchantmentCost(t2.id));
  });
});
