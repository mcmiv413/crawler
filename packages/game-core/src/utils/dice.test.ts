/**
 * Test layer: unit
 * Behavior: Dice covers rollDamage; returns a value within the expected variance range; produces deterministic results with the same seed.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/utils/dice.test.ts
 */
import { describe, it, expect } from 'vitest';
import { rollDamage, calculateHitChance, applyDefense } from './dice.js';
import { SeededRNG } from './rng.js';

describe('rollDamage', () => {
  it('returns a value within the expected variance range', () => {
    const rng = new SeededRNG(42);
    const base = 10;
    const variance = 0.15; // 15% variance as used in COMBAT constants
    // Result should be base * (1 ± variance), so between 8.5 and 11.5, rounded, min 1
    const result = rollDamage(base, variance, rng);
    expect(result).toBeGreaterThanOrEqual(Math.round(base * (1 - variance)));
    expect(result).toBeLessThanOrEqual(Math.round(base * (1 + variance)));
  });

  it('produces deterministic results with the same seed', () => {
    const rng1 = new SeededRNG(99);
    const rng2 = new SeededRNG(99);
    expect(rollDamage(15, 0.15, rng1)).toBe(rollDamage(15, 0.15, rng2));
  });
});

describe('calculateHitChance', () => {
  it('clamps the hit chance to min and max', () => {
    expect(calculateHitChance(200, 0, 0, 15, 95)).toBe(95);
    expect(calculateHitChance(0, 0, 100, 15, 95)).toBe(15);
  });

  it('returns the calculated value when within bounds', () => {
    // 50 + 10 - 5 = 55
    expect(calculateHitChance(50, 10, 5, 0, 100)).toBe(55);
  });
});

describe('applyDefense', () => {
  it('mitigates damage using defense/(defense+divisor) formula', () => {
    // damage * (1 - defense/(defense+divisor))
    // 50 * (1 - 20/(20+50)) = 50 * (1 - 0.2857) = 50 * 0.7143 = 36 (rounded)
    const result = applyDefense(50, 20, 50);
    expect(result).toBe(36);
  });

  it('returns minimum 1 damage', () => {
    const result = applyDefense(1, 999, 1);
    expect(result).toBe(1);
  });
});
