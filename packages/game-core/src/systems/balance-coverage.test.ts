/**
 * Test layer: unit
 * Behavior: Balance Coverage covers Balance Coverage — RNG Unit Tests; RNG determinism: same seed produces identical sequences; SeededRNG implements RNG interface correctly.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/systems/balance-coverage.test.ts
 */
import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../utils/rng.js';
import type { RNG } from '@dungeon/contracts';

/**
 * Unit tests: RNG determinism and interface compliance.
 *
 * Tests pure SeededRNG behavior — no live @dungeon/content imports.
 * BalanceConfig creation tests live in tests/contracts/balance-constants.contract.test.ts.
 */
describe('Balance Coverage — RNG Unit Tests', () => {
  it('RNG determinism: same seed produces identical sequences', () => {
    const rng1 = new SeededRNG(42);
    const rng2 = new SeededRNG(42);

    for (let i = 0; i < 100; i++) {
      expect(rng1.next()).toBe(rng2.next());
    }
  });

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
    expect(shuffled).toHaveLength(5);
    expect(shuffled.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]); // Same elements
  });

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

  it('getSeed() returns the seed used to initialize RNG', () => {
    const seed = 123456;
    const rng = new SeededRNG(seed);
    expect(rng.getSeed()).toBe(seed);
  });
});
