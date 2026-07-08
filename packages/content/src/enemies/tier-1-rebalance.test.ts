/**
 * Test layer: unit
 * Behavior: Tier 1 enemy stats keep cave rat, skeleton warrior, and pit spider within intended relative health, attack, and defense bands.
 * Proof: Assertions compare stat ranges for cave rat, skeleton stats greater than cave rat but below caps, and pit spider stats between or above rat values while staying under skeleton/cap limits.
 * Validation: pnpm vitest run packages/content/src/enemies/tier-1-rebalance.test.ts
 */
import { describe, it, expect } from 'vitest';
import { caveRat, skeletonWarrior, pitSpider } from './index.js';

describe('Tier 1 Enemy Rebalance', () => {
  describe('Cave Rat', () => {
    it('should have reasonable HP', () => {
      expect(caveRat.stats.maxHealth).toBeGreaterThan(15);
      expect(caveRat.stats.maxHealth).toBeLessThan(60);
    });

    it('should have reasonable attack', () => {
      expect(caveRat.stats.attack).toBeGreaterThanOrEqual(5);
      expect(caveRat.stats.attack).toBeLessThan(25);
    });

    it('should have low defense', () => {
      expect(caveRat.stats.defense).toBeGreaterThanOrEqual(1);
      expect(caveRat.stats.defense).toBeLessThan(10);
    });
  });

  describe('Skeleton Warrior', () => {
    it('should have more HP than cave rat', () => {
      expect(skeletonWarrior.stats.maxHealth).toBeGreaterThan(caveRat.stats.maxHealth);
      expect(skeletonWarrior.stats.maxHealth).toBeLessThan(100);
    });

    it('should have more attack than cave rat', () => {
      expect(skeletonWarrior.stats.attack).toBeGreaterThan(caveRat.stats.attack);
      expect(skeletonWarrior.stats.attack).toBeLessThan(30);
    });

    it('should have more defense than cave rat', () => {
      expect(skeletonWarrior.stats.defense).toBeGreaterThan(caveRat.stats.defense);
      expect(skeletonWarrior.stats.defense).toBeLessThan(20);
    });
  });

  describe('Pit Spider', () => {
    it('should have reasonable HP between rat and skeleton', () => {
      expect(pitSpider.stats.maxHealth).toBeGreaterThan(caveRat.stats.maxHealth);
      expect(pitSpider.stats.maxHealth).toBeLessThanOrEqual(skeletonWarrior.stats.maxHealth);
    });

    it('should have reasonable attack', () => {
      expect(pitSpider.stats.attack).toBeGreaterThan(caveRat.stats.attack);
      expect(pitSpider.stats.attack).toBeLessThan(25);
    });

    it('should have low defense', () => {
      expect(pitSpider.stats.defense).toBeGreaterThanOrEqual(caveRat.stats.defense);
      expect(pitSpider.stats.defense).toBeLessThan(15);
    });
  });
});
