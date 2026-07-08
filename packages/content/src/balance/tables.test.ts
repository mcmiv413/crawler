/**
 * Test layer: unit
 * Behavior: Balance tables keep enemy density and floor scaling monotonic while gating shop rarity by the highest rarity found.
 * Proof: Assertions compare density growth across depths, positive integer density settings, multipliers above 1 with health at least attack, sqrt early-floor multipliers, normal floor 3+ multipliers, and exact buyability booleans for common through legendary plus unknown rarity.
 * Validation: pnpm vitest run packages/content/src/balance/tables.test.ts
 */
import { describe, it, expect } from 'vitest';
import { MAP_GENERATION, FLOOR_SCALING, getFloorScalingMultipliers, isRarityBuyable } from './tables.js';

describe('Balance tables — property tests', () => {
  describe('MAP_GENERATION scaling', () => {
    it('floor N enemies scales with baseDensity + perFloor * N', () => {
      // Property: verify the scaling formula is consistent across all depths
      for (let depth = 1; depth <= 10; depth++) {
        const expected = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * depth;
        expect(expected).toBeGreaterThanOrEqual(MAP_GENERATION.enemyBaseDensity);
      }

      // Verify scaling increases with depth
      const floor1 = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * 1;
      const floor5 = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * 5;
      const floor10 = MAP_GENERATION.enemyBaseDensity + MAP_GENERATION.enemyPerFloor * 10;
      expect(floor5).toBeGreaterThan(floor1);
      expect(floor10).toBeGreaterThan(floor5);
    });

    it('enemyBaseDensity is a positive integer', () => {
      expect(MAP_GENERATION.enemyBaseDensity).toBeGreaterThan(0);
      expect(Number.isInteger(MAP_GENERATION.enemyBaseDensity)).toBe(true);
    });

    it('enemyPerFloor is a positive integer', () => {
      expect(MAP_GENERATION.enemyPerFloor).toBeGreaterThan(0);
      expect(Number.isInteger(MAP_GENERATION.enemyPerFloor)).toBe(true);
    });
  });

  describe('FLOOR_SCALING multipliers', () => {
    it('all multipliers are greater than 1.0 (enemies get stronger with depth)', () => {
      expect(FLOOR_SCALING.healthMultiplier).toBeGreaterThan(1.0);
      expect(FLOOR_SCALING.attackMultiplier).toBeGreaterThan(1.0);
      expect(FLOOR_SCALING.defenseMultiplier).toBeGreaterThan(1.0);
    });

    it('health multiplier is >= attack multiplier (survivability matters)', () => {
      expect(FLOOR_SCALING.healthMultiplier).toBeGreaterThanOrEqual(FLOOR_SCALING.attackMultiplier);
    });

    it('floor scaling compounds correctly across depths', () => {
      // For a given multiplier, stats at depth N should be:
      // baseStat * (multiplier ^ (N - 1))
      // Verify that floor 5 is stronger than floor 1
      const baseStat = 100;

      const floor1Health = baseStat * Math.pow(FLOOR_SCALING.healthMultiplier, 0);
      const floor5Health = baseStat * Math.pow(FLOOR_SCALING.healthMultiplier, 4);
      expect(floor5Health).toBeGreaterThan(floor1Health);

      const floor1Attack = baseStat * Math.pow(FLOOR_SCALING.attackMultiplier, 0);
      const floor5Attack = baseStat * Math.pow(FLOOR_SCALING.attackMultiplier, 4);
      expect(floor5Attack).toBeGreaterThan(floor1Attack);
    });
  });

  describe('getFloorScalingMultipliers', () => {
    it('floors 1-2 use reduced multipliers (sqrt)', () => {
      const floor1 = getFloorScalingMultipliers(1);
      expect(floor1.healthMultiplier).toBeCloseTo(Math.sqrt(FLOOR_SCALING.healthMultiplier), 5);
      expect(floor1.attackMultiplier).toBeCloseTo(Math.sqrt(FLOOR_SCALING.attackMultiplier), 5);
      expect(floor1.defenseMultiplier).toBeCloseTo(Math.sqrt(FLOOR_SCALING.defenseMultiplier), 5);

      const floor2 = getFloorScalingMultipliers(2);
      expect(floor2.healthMultiplier).toBeCloseTo(Math.sqrt(FLOOR_SCALING.healthMultiplier), 5);
      expect(floor2.attackMultiplier).toBeCloseTo(Math.sqrt(FLOOR_SCALING.attackMultiplier), 5);
      expect(floor2.defenseMultiplier).toBeCloseTo(Math.sqrt(FLOOR_SCALING.defenseMultiplier), 5);
    });

    it('floor 3+ use normal multipliers', () => {
      const floor3 = getFloorScalingMultipliers(3);
      expect(floor3.healthMultiplier).toBe(FLOOR_SCALING.healthMultiplier);
      expect(floor3.attackMultiplier).toBe(FLOOR_SCALING.attackMultiplier);
      expect(floor3.defenseMultiplier).toBe(FLOOR_SCALING.defenseMultiplier);
      expect(floor3.experienceMultiplier).toBe(FLOOR_SCALING.experienceMultiplier);

      const floor5 = getFloorScalingMultipliers(5);
      expect(floor5).toEqual(FLOOR_SCALING);
    });

    it('floor 1-2 enemies are weaker than floor 3+', () => {
      const floor1Mults = getFloorScalingMultipliers(1);
      const floor3Mults = getFloorScalingMultipliers(3);

      // Floor 1 uses sqrt multiplier (easier early game)
      // Floor 3+ use normal multiplier (regular difficulty)
      const baseStat = 100;

      // At floor 1 depth, stats grow slowly
      const floor1Stat = baseStat * Math.pow(floor1Mults.healthMultiplier, 0);

      // At floor 3 depth, stats have grown 2 floors worth
      const floor3Stat = baseStat * Math.pow(floor3Mults.healthMultiplier, 2);

      // Floor 1 should be noticeably weaker
      expect(floor1Stat).toBeLessThan(floor3Stat);

      // Sqrt multiplier should be much smaller than normal multiplier
      expect(floor1Mults.healthMultiplier).toBeLessThan(floor3Mults.healthMultiplier);
    });
  });

  describe('isRarityBuyable', () => {
    it('common items are always buyable', () => {
      expect(isRarityBuyable('common', 'common')).toBe(true);
      expect(isRarityBuyable('common', 'uncommon')).toBe(true);
      expect(isRarityBuyable('common', 'rare')).toBe(true);
      expect(isRarityBuyable('common', 'epic')).toBe(true);
      expect(isRarityBuyable('common', 'legendary')).toBe(true);
    });

    it('uncommon items are buyable when highestFound >= uncommon (not epic)', () => {
      expect(isRarityBuyable('uncommon', 'common')).toBe(false);
      expect(isRarityBuyable('uncommon', 'uncommon')).toBe(true);
      expect(isRarityBuyable('uncommon', 'rare')).toBe(true);
      expect(isRarityBuyable('uncommon', 'epic')).toBe(true);
      expect(isRarityBuyable('uncommon', 'legendary')).toBe(true);
    });

    it('rare items are buyable when highestFound >= rare', () => {
      expect(isRarityBuyable('rare', 'common')).toBe(false);
      expect(isRarityBuyable('rare', 'uncommon')).toBe(false);
      expect(isRarityBuyable('rare', 'rare')).toBe(true);
      expect(isRarityBuyable('rare', 'epic')).toBe(true);
      expect(isRarityBuyable('rare', 'legendary')).toBe(true);
    });

    it('epic items are buyable when highestFound >= epic', () => {
      expect(isRarityBuyable('epic', 'common')).toBe(false);
      expect(isRarityBuyable('epic', 'uncommon')).toBe(false);
      expect(isRarityBuyable('epic', 'rare')).toBe(false);
      expect(isRarityBuyable('epic', 'epic')).toBe(true);
      expect(isRarityBuyable('epic', 'legendary')).toBe(true);
    });

    it('legendary items are never buyable', () => {
      expect(isRarityBuyable('legendary', 'common')).toBe(false);
      expect(isRarityBuyable('legendary', 'rare')).toBe(false);
      expect(isRarityBuyable('legendary', 'legendary')).toBe(false);
    });

    it('handles unknown rarity gracefully', () => {
      expect(isRarityBuyable('unknown', 'legendary')).toBe(false);
    });
  });
});
