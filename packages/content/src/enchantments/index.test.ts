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
  it('returns correct costs per tier', () => {
    expect(getEnchantmentCost('hp_regen')).toBe(ENCHANTMENT_COSTS[1]);    // T1
    expect(getEnchantmentCost('defense_boost')).toBe(ENCHANTMENT_COSTS[2]); // T2
    expect(getEnchantmentCost('exp_bonus')).toBe(ENCHANTMENT_COSTS[3]);   // T3
    expect(getEnchantmentCost('blink')).toBe(ENCHANTMENT_COSTS['unique']); // Unique
  });

  it('T1 cost === 40 (Area 2a tuning)', () => {
    expect(ENCHANTMENT_COSTS[1]).toBe(40);
  });

  it('T2 cost === 100 (Area 2a tuning)', () => {
    expect(ENCHANTMENT_COSTS[2]).toBe(100);
  });

  it('T3 cost === 200 (Area 2a tuning)', () => {
    expect(ENCHANTMENT_COSTS[3]).toBe(200);
  });

  it('unique cost === 150 (Area 2a tuning)', () => {
    expect(ENCHANTMENT_COSTS['unique']).toBe(150);
  });

  it('returns 0 for unknown enchantment', () => {
    expect(getEnchantmentCost('nonexistent')).toBe(0);
  });
});

describe('getImpliedBlueprints', () => {
  it('T1 enchantment only implies itself', () => {
    const implied = getImpliedBlueprints('hp_regen');
    expect(implied).toContain('hp_regen');
    expect(implied.length).toBe(1);
  });

  it('T2 enchantment only implies itself', () => {
    const implied = getImpliedBlueprints('defense_boost');
    expect(implied).toContain('defense_boost');
    expect(implied.length).toBe(1);
  });

  it('T3 enchantment only implies itself', () => {
    const implied = getImpliedBlueprints('exp_bonus');
    expect(implied).toContain('exp_bonus');
    expect(implied.length).toBe(1);
  });

  it('unique enchantment only implies itself', () => {
    const implied = getImpliedBlueprints('blink');
    expect(implied).toContain('blink');
    expect(implied.length).toBe(1);
  });

  it('returns empty array for unknown enchantment', () => {
    expect(getImpliedBlueprints('unknown')).toEqual([]);
  });
});
