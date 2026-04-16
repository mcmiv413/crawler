import { describe, it, expect } from 'vitest';
import {
  MAX_EVENT_HISTORY,
  PROSPERITY_DELTAS,
  KILL_STREAK_BONUSES,
  NPC_THRESHOLDS,
  FEAR_ESCALATION,
  NEMESIS_SLAIN_WORLD_EFFECTS,
  CORRUPTION_MODIFIERS,
  FEAR_MODIFIERS,
  WORLD_MODIFIER_CAPS,
} from '@dungeon/content';

/**
 * Governance test: Balance constants are properly exported and accessible
 * This ensures the centralization hub is complete and working.
 */

describe('Config Governance: Balance Constants', () => {
  it('all balance constants are properly exported from tables.ts', () => {
    expect(MAX_EVENT_HISTORY).toBeGreaterThan(0);

    // Prosperity deltas exist and are reasonable
    expect(PROSPERITY_DELTAS.onDeath).toBeLessThan(0);
    expect(PROSPERITY_DELTAS.onRetreatPerFloor).toBeGreaterThan(0);
    expect(PROSPERITY_DELTAS.onVictoryBase).toBeGreaterThan(0);
    expect(PROSPERITY_DELTAS.onVictoryPerFloor).toBeGreaterThan(0);

    // Kill streaks exist and scale reasonably
    expect(KILL_STREAK_BONUSES.tier1Kills).toBeGreaterThan(0);
    expect(KILL_STREAK_BONUSES.tier1Bonus).toBeGreaterThan(0);
    expect(KILL_STREAK_BONUSES.tier2Kills).toBeGreaterThan(KILL_STREAK_BONUSES.tier1Kills);
    expect(KILL_STREAK_BONUSES.tier2Bonus).toBeGreaterThanOrEqual(KILL_STREAK_BONUSES.tier1Bonus);

    // NPC thresholds are sensible (return > leave)
    expect(NPC_THRESHOLDS.shopkeeperLeavesProsperity).toBeGreaterThan(0);
    expect(NPC_THRESHOLDS.shopkeeperReturnsProsperity).toBeGreaterThan(NPC_THRESHOLDS.shopkeeperLeavesProsperity);

    // Fear escalation parameters exist
    expect(FEAR_ESCALATION.recentEventWindow).toBeGreaterThan(0);
    expect(FEAR_ESCALATION.deathsToTrigger).toBeGreaterThan(0);
    expect(FEAR_ESCALATION.fearGain).toBeGreaterThan(0);
    expect(FEAR_ESCALATION.fearCap).toBeGreaterThan(0);

    // Nemesis slain effects are positive
    expect(NEMESIS_SLAIN_WORLD_EFFECTS.prosperityGain).toBeGreaterThan(0);
    expect(NEMESIS_SLAIN_WORLD_EFFECTS.corruptionLoss).toBeGreaterThan(0);
    expect(NEMESIS_SLAIN_WORLD_EFFECTS.corruptionPerActiveNemesis).toBeGreaterThan(0);

    // Corruption modifiers are reasonable
    expect(CORRUPTION_MODIFIERS.preferCorruptEnemiesAbove).toBeGreaterThan(0);
    expect(CORRUPTION_MODIFIERS.preferCorruptEnemiesAbove).toBeLessThanOrEqual(100);
    expect(CORRUPTION_MODIFIERS.enemyHealthBonusAbove).toBeGreaterThan(0);
    expect(CORRUPTION_MODIFIERS.enemyHealthMultiplier).toBeGreaterThan(1);
    expect(CORRUPTION_MODIFIERS.tierUpgradeChanceAbove).toBeGreaterThan(0);
    expect(CORRUPTION_MODIFIERS.tierUpgradeChance).toBeGreaterThan(0);
    expect(CORRUPTION_MODIFIERS.tierUpgradeChance).toBeLessThan(1);
    expect(CORRUPTION_MODIFIERS.earlyBossAbove).toBeGreaterThan(0);
    expect(CORRUPTION_MODIFIERS.earlyBossFloorAdjust).toBeLessThanOrEqual(0);

    // Fear modifiers exist
    expect(FEAR_MODIFIERS.preferFastEnemiesAbove).toBeGreaterThan(0);
    expect(FEAR_MODIFIERS.preferFastEnemiesAbove).toBeLessThanOrEqual(100);

    // World modifier caps are positive
    expect(WORLD_MODIFIER_CAPS.maxExtraEnemies).toBeGreaterThan(0);
  });
});
