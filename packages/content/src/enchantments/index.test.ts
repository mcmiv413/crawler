import { describe, it, expect } from 'vitest';
import {
  ENCHANTMENT_BY_ID,
  getEnchantmentCost,
  getImpliedBlueprints,
  ENCHANTMENT_COSTS,
} from './index.js';

const EXPECTED_IDS = [
  'hp_regen', 'thorns', 'resist_fire', 'resist_frost', 'resist_poison',
  'evasion_boost', 'defense_boost', 'blight_ward', 'spikes', 'speed_boost',
  'exp_bonus', 'life_steal', 'arcane_ward', 'blink',
];

describe('enchantment catalog', () => {
  it('contains all 14 enchantment IDs', () => {
    for (const id of EXPECTED_IDS) {
      expect(ENCHANTMENT_BY_ID.has(id), `missing ${id}`).toBe(true);
    }
    expect(ENCHANTMENT_BY_ID.size).toBe(14);
  });

  it('tier assignments are correct', () => {
    const t1 = ['hp_regen', 'thorns', 'resist_fire', 'resist_frost', 'resist_poison'];
    const t2 = ['evasion_boost', 'defense_boost', 'blight_ward', 'spikes', 'speed_boost'];
    const t3 = ['exp_bonus', 'life_steal', 'arcane_ward'];
    const unique = ['blink'];

    for (const id of t1) expect(ENCHANTMENT_BY_ID.get(id)!.tier).toBe(1);
    for (const id of t2) expect(ENCHANTMENT_BY_ID.get(id)!.tier).toBe(2);
    for (const id of t3) expect(ENCHANTMENT_BY_ID.get(id)!.tier).toBe(3);
    for (const id of unique) expect(ENCHANTMENT_BY_ID.get(id)!.tier).toBe('unique');
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
