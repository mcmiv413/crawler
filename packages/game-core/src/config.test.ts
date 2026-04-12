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
    expect(MAX_EVENT_HISTORY).toBe(100);

    // Prosperity deltas
    expect(PROSPERITY_DELTAS.onDeath).toBe(-3);
    expect(PROSPERITY_DELTAS.onRetreatPerFloor).toBe(2);
    expect(PROSPERITY_DELTAS.onVictoryBase).toBe(10);
    expect(PROSPERITY_DELTAS.onVictoryPerFloor).toBe(1);

    // Kill streaks
    expect(KILL_STREAK_BONUSES.tier1Kills).toBe(5);
    expect(KILL_STREAK_BONUSES.tier1Bonus).toBe(2);
    expect(KILL_STREAK_BONUSES.tier2Kills).toBe(10);
    expect(KILL_STREAK_BONUSES.tier2Bonus).toBe(3);

    // NPC thresholds
    expect(NPC_THRESHOLDS.shopkeeperLeavesProsperity).toBe(25);
    expect(NPC_THRESHOLDS.shopkeeperReturnsProsperity).toBe(40);

    // Fear escalation
    expect(FEAR_ESCALATION.recentEventWindow).toBe(20);
    expect(FEAR_ESCALATION.deathsToTrigger).toBe(3);
    expect(FEAR_ESCALATION.fearGain).toBe(10);
    expect(FEAR_ESCALATION.fearCap).toBe(80);

    // Nemesis slain effects
    expect(NEMESIS_SLAIN_WORLD_EFFECTS.prosperityGain).toBe(10);
    expect(NEMESIS_SLAIN_WORLD_EFFECTS.corruptionLoss).toBe(5);
    expect(NEMESIS_SLAIN_WORLD_EFFECTS.corruptionPerActiveNemesis).toBe(2);

    // Corruption modifiers
    expect(CORRUPTION_MODIFIERS.preferCorruptEnemiesAbove).toBe(50);
    expect(CORRUPTION_MODIFIERS.enemyHealthBonusAbove).toBe(50);
    expect(CORRUPTION_MODIFIERS.enemyHealthMultiplier).toBe(1.1);
    expect(CORRUPTION_MODIFIERS.tierUpgradeChanceAbove).toBe(75);
    expect(CORRUPTION_MODIFIERS.tierUpgradeChance).toBe(0.1);
    expect(CORRUPTION_MODIFIERS.earlyBossAbove).toBe(90);
    expect(CORRUPTION_MODIFIERS.earlyBossFloorAdjust).toBe(-1);

    // Fear modifiers
    expect(FEAR_MODIFIERS.preferFastEnemiesAbove).toBe(60);

    // World modifier caps
    expect(WORLD_MODIFIER_CAPS.maxExtraEnemies).toBe(3);
  });
});
