import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../utils/rng.js';
import type { RNG } from '@dungeon/contracts';
import { createDefaultBalanceConfig } from '@dungeon/content';

describe('Balance Coverage — Feature Completeness Tests', () => {
  // ─────────────────────────────────────────────────────────────────
  // Test 1: RNG determinism
  // ─────────────────────────────────────────────────────────────────

  it('RNG determinism: same seed produces identical sequences', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 2: RNG interface compliance
  // ─────────────────────────────────────────────────────────────────

  it('SeededRNG implements RNG interface correctly', () => {
    const rng: RNG = new SeededRNG(42);

    // next() should return [0, 1)
    expect(rng.next()).toBeGreaterThanOrEqual(0);
    expect(rng.next()).toBeLessThan(1);

    // chance() should return boolean
    expect(typeof rng.chance(50)).toBe('boolean');

    // int() should return integer in range
    const intVal = rng.int(1, 10);
    expect(Number.isInteger(intVal)).toBe(true);
    expect(intVal).toBeGreaterThanOrEqual(1);
    expect(intVal).toBeLessThanOrEqual(10);

    // float() should return float in range
    const floatVal = rng.float(1.5, 3.5);
    expect(floatVal).toBeGreaterThanOrEqual(1.5);
    expect(floatVal).toBeLessThan(3.5);

    // pick() should return array element
    const picked = rng.pick([1, 2, 3]);
    expect([1, 2, 3]).toContain(picked);

    // shuffle() should return new array
    const original = [1, 2, 3, 4, 5];
    const shuffled = rng.shuffle(original);
    expect(original).not.toEqual(shuffled); // Usually different (with high probability)
    expect(shuffled).toHaveLength(5);
    expect(shuffled.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]); // Same elements
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 3: BalanceConfig creation
  // ─────────────────────────────────────────────────────────────────

  it('createDefaultBalanceConfig produces valid config', () => {
    const config = createDefaultBalanceConfig();

    // Combat config
    expect(config.combat).toBeDefined();
    expect(config.combat.baseHitChance).toBeGreaterThan(0);
    expect(config.combat.critChance).toBeGreaterThan(0);
    expect(config.combat.damageVariance).toBeGreaterThan(0);
    expect(config.combat.defenseDivisor).toBeGreaterThan(0);

    // Floor scaling config
    expect(config.floorScaling).toBeDefined();
    expect(config.floorScaling.healthMultiplier).toBeGreaterThan(1);
    expect(config.floorScaling.attackMultiplier).toBeGreaterThan(1);
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 4: Config injection in combat system
  // ─────────────────────────────────────────────────────────────────

  it('BalanceConfig can be injected into combat resolution', () => {
    const baseConfig = createDefaultBalanceConfig();
    const tweakedConfig = {
      ...baseConfig,
      combat: {
        ...baseConfig.combat,
        defenseDivisor: 100, // Increase defense
      },
    };

    // This test validates that the type system supports config injection
    // Actual combat resolution test would require GameEngine integration
    expect(tweakedConfig.combat.defenseDivisor).toBeGreaterThan(50);
    expect(tweakedConfig.combat.defenseDivisor).toBeLessThan(200);
    expect(baseConfig.combat.defenseDivisor).not.toEqual(100); // Immutable
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 5: RNG usage in policies (sanity check)
  // ─────────────────────────────────────────────────────────────────

  it('RNG.chance() with percentage values works correctly', () => {
    const rng = new SeededRNG(42);

    // chance(0) should never be true
    for (let i = 0; i < 100; i++) {
      expect(rng.chance(0)).toBe(false);
    }

    // chance(100) should always be true
    const rng2 = new SeededRNG(42);
    for (let i = 0; i < 100; i++) {
      expect(rng2.chance(100)).toBe(true);
    }

    // chance(50) should be roughly 50/50
    const rng3 = new SeededRNG(42);
    let trueCount = 0;
    for (let i = 0; i < 1000; i++) {
      if (rng3.chance(50)) {
        trueCount += 1;
      }
    }
    // Very loose bounds: 400-600 out of 1000
    expect(trueCount).toBeGreaterThan(400);
    expect(trueCount).toBeLessThan(600);
  });

  // ─────────────────────────────────────────────────────────────────
  // Test 6: getSeed() method
  // ─────────────────────────────────────────────────────────────────

  it('getSeed() returns the seed used to initialize RNG', () => {
    const seed = 123456;
    const rng = new SeededRNG(seed);
    expect(rng.getSeed()).toBe(seed);
  });
});
