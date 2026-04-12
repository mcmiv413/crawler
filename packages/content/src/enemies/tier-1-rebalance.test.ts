import { describe, it, expect } from 'vitest';
import { caveRat, skeletonWarrior, pitSpider } from './index.js';

describe('Tier 1 Enemy Rebalance', () => {
  describe('Cave Rat', () => {
    it('should have 30 HP', () => {
      expect(caveRat.stats.maxHealth).toBe(30);
    });

    it('should have 10 attack', () => {
      expect(caveRat.stats.attack).toBe(10);
    });

    it('should have 3 defense', () => {
      expect(caveRat.stats.defense).toBe(3);
    });
  });

  describe('Skeleton Warrior', () => {
    it('should have 50 HP', () => {
      expect(skeletonWarrior.stats.maxHealth).toBe(50);
    });

    it('should have 14 attack', () => {
      expect(skeletonWarrior.stats.attack).toBe(14);
    });

    it('should have 8 defense', () => {
      expect(skeletonWarrior.stats.defense).toBe(8);
    });
  });

  describe('Pit Spider', () => {
    it('should have 35 HP', () => {
      expect(pitSpider.stats.maxHealth).toBe(35);
    });

    it('should have 12 attack', () => {
      expect(pitSpider.stats.attack).toBe(12);
    });

    it('should have 4 defense', () => {
      expect(pitSpider.stats.defense).toBe(4);
    });
  });
});
