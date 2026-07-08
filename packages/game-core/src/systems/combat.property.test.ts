/**
 * Test layer: property
 * Behavior: Combat covers Combat - Property-Based Tests; Hit chance determinism; same seed produces same hitmiss sequences.
 * Proof: seeded/generated cases preserve the invariant under varied inputs.
 * Validation: pnpm vitest run packages/game-core/src/systems/combat.property.test.ts
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { SeededRNG } from '../utils/rng.js';
import { resolveAttack } from './combat.js';
import { entityId } from '@dungeon/contracts';
import type { CombatContext } from '@dungeon/contracts';

describe('Combat - Property-Based Tests', () => {
  describe('Hit chance determinism', () => {
    it('same seed produces same hit/miss sequences', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 20 }),    // typical accuracy
          fc.integer({ min: 0, max: 20 }),    // typical evasion
          fc.integer({ min: 50, max: 150 }),  // typical attack
          fc.integer({ min: 50, max: 150 }),  // seed
          (accuracy, evasion, attack, seed) => {
            const rng1 = new SeededRNG(seed);
            const rng2 = new SeededRNG(seed);

            const ctx: CombatContext = {
              attackerId: entityId('test-attacker'),
              defenderId: entityId('test-defender'),
              attackerAttack: attack,
              attackerAccuracy: accuracy,
              defenderDefense: 5,
              defenderEvasion: evasion,
              defenderHealth: 100,
              damageType: 'physical',
              defenderResistance: 0,
            };

            for (let i = 0; i < 20; i++) {
              const result1 = resolveAttack(ctx, rng1);
              const result2 = resolveAttack(ctx, rng2);
              expect(result1.hit).toBe(result2.hit);
              expect(result1.hitRoll).toBe(result2.hitRoll);
            }
          },
        ),
        { numRuns: 20 },
      );
    });
  });

  describe('RNG isolation and independence', () => {
    it('two SeededRNG instances with different seeds should produce independent sequences', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (seed1, seed2) => {
            fc.pre(seed1 !== seed2);  // Ensure different seeds

            const rng1 = new SeededRNG(seed1);
            const rng2 = new SeededRNG(seed2);

            // Generate sequences from both RNGs
            const seq1: number[] = [];
            const seq2: number[] = [];
            const length = 20;

            for (let i = 0; i < length; i++) {
              seq1.push(rng1.next());
              seq2.push(rng2.next());
            }

            // Sequences should not be identical (with very high probability)
            expect(seq1).not.toEqual(seq2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('same seed should produce identical sequences', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          (seed) => {
            const rng1 = new SeededRNG(seed);
            const rng2 = new SeededRNG(seed);

            // Generate sequences from both RNGs
            const seq1: number[] = [];
            const seq2: number[] = [];
            const length = 20;

            for (let i = 0; i < length; i++) {
              seq1.push(rng1.next());
              seq2.push(rng2.next());
            }

            // Sequences should be identical
            expect(seq1).toEqual(seq2);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('concurrent RNG instances should not interfere with each other', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 10000 }),
          fc.integer({ min: 0, max: 10000 }),
          (seed1, seed2) => {
            fc.pre(seed1 !== seed2);

            const rng1 = new SeededRNG(seed1);
            const rng2 = new SeededRNG(seed2);

            // Simulate alternating calls (like concurrent requests)
            const sequence1: number[] = [];
            const sequence2: number[] = [];

            for (let i = 0; i < 10; i++) {
              sequence1.push(rng1.next());
              sequence2.push(rng2.next());
              sequence1.push(rng1.next());
              sequence2.push(rng2.next());
            }

            // Create fresh instances with same seeds for comparison
            const rng1Fresh = new SeededRNG(seed1);
            const rng2Fresh = new SeededRNG(seed2);
            const sequence1Fresh: number[] = [];
            const sequence2Fresh: number[] = [];

            for (let i = 0; i < 20; i++) {
              sequence1Fresh.push(rng1Fresh.next());
            }
            for (let i = 0; i < 20; i++) {
              sequence2Fresh.push(rng2Fresh.next());
            }

            // Alternating calls should produce same results as sequential calls
            expect(sequence1).toEqual(sequence1Fresh);
            expect(sequence2).toEqual(sequence2Fresh);
          },
        ),
        { numRuns: 50 },
      );
    });

    it('SeededRNG.chance() should respect probability bounds', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),    // probability percentage
          fc.integer({ min: 50, max: 150 }),   // seed
          (probability, seed) => {
            const rng = new SeededRNG(seed);
            let trueCount = 0;
            const trials = 200;

            for (let i = 0; i < trials; i++) {
              if (rng.chance(probability)) {
                trueCount++;
              }
            }

            const actualPercent = (trueCount / trials) * 100;
            const tolerance = 15;  // Allow 15% tolerance due to randomness

            // For extreme probabilities, check bounds
            if (probability === 0) {
              expect(trueCount).toBeLessThanOrEqual(0);
            } else if (probability === 100) {
              expect(trueCount).toBe(trials);
            } else {
              // For middle-range probabilities, check within tolerance
              expect(actualPercent).toBeGreaterThan(probability - tolerance);
              expect(actualPercent).toBeLessThan(probability + tolerance);
            }
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
