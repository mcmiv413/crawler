import type { RunTelemetry, AggregateMetrics, BehaviorEffectivenessRecord } from './types.js';
import type { PolicyId } from './policies.js';

/**
 * Aggregate telemetry from multiple runs into comprehensive metrics.
 * Includes statistical analysis of win rates, engagement, danger signals, comeback strength, and policy variance.
 */
export function aggregateMetrics(runs: readonly RunTelemetry[]): AggregateMetrics {
  if (runs.length === 0) {
    throw new Error('Cannot aggregate metrics: no runs provided');
  }

  // Separate runs by floor tier
  const earlyRuns = runs.filter(r => r.floorReached <= 3);
  const midRuns = runs.filter(r => r.floorReached >= 4 && r.floorReached <= 6);
  const lateRuns = runs.filter(r => r.floorReached >= 7);

  // Win rates by tier
  const earlyWinRate = earlyRuns.length > 0 ? earlyRuns.filter(r => r.victory).length / earlyRuns.length : 0;
  const midWinRate = midRuns.length > 0 ? midRuns.filter(r => r.victory).length / midRuns.length : 0;
  const lateWinRate = lateRuns.length > 0 ? lateRuns.filter(r => r.victory).length / lateRuns.length : 0;

  // Engagement
  const winsRuns = runs.filter(r => r.victory);
  const avgTurnsPerWin = winsRuns.length > 0 ? winsRuns.reduce((sum, r) => sum + r.turns, 0) / winsRuns.length : 0;
  const avgHpRemainingOnWin = winsRuns.length > 0
    ? winsRuns.reduce((sum, r) => sum + (r.playerHpEnd / Math.max(1, r.playerHpStart)), 0) / winsRuns.length
    : 0;

  // Danger signals
  const burstDeaths = runs.filter(r => {
    return r.encounterStats.some(e => e.burstSource !== null);
  });
  const burstDeathRate = burstDeaths.length / runs.length;

  // Burst source attribution
  const mutableBurstDeathsBySource = {
    single_enemy: 0,
    multi_focus: 0,
    ability_spike: 0,
  };
  for (const run of burstDeaths) {
    for (const encounter of run.encounterStats) {
      if (encounter.burstSource === 'single_enemy') {
        mutableBurstDeathsBySource.single_enemy += 1;
      } else if (encounter.burstSource === 'multi_focus') {
        mutableBurstDeathsBySource.multi_focus += 1;
      } else if (encounter.burstSource === 'ability_spike') {
        mutableBurstDeathsBySource.ability_spike += 1;
      }
    }
  }
  const burstDeathsBySource = mutableBurstDeathsBySource;

  // Attrition: long, grinding fights
  const attritionDeaths = runs.filter(r => r.turns > 100 && !r.victory).length;
  const attritionDeathRate = attritionDeaths / runs.length;

  // Steamroll: trivially easy
  const steamrolls = runs.filter(r => r.victory && r.playerHpEnd / r.playerHpStart > 0.8).length;
  const steamrollRate = steamrolls / runs.length;

  // Stale fight: no progression
  const staleFights = runs.filter(r => r.turns > 100).length;
  const staleFightRate = staleFights / runs.length;

  // Consumable usage
  const consumableUsageRate = runs.reduce((sum, r) => sum + r.consumablesUsed, 0) / Math.max(1, runs.length);

  // Comeback metrics
  const comebackRuns = runs.filter(r => r.comebackCount > 0);
  const comebackRate = comebackRuns.length / runs.length;
  const avgComebackStrength = comebackRuns.length > 0
    ? comebackRuns.reduce((sum, r) => sum + r.comebackStrength, 0) / comebackRuns.length
    : 0;
  const avgComebackCount = runs.reduce((sum, r) => sum + r.comebackCount, 0) / runs.length;

  // Policy variance (for agency measurement)
  const policyWinRatesByPolicy = new Map<PolicyId, number>();
  for (const run of runs) {
    if (!policyWinRatesByPolicy.has(run.policy)) {
      const policyRuns = runs.filter(r => r.policy === run.policy);
      const policyWins = policyRuns.filter(r => r.victory).length;
      policyWinRatesByPolicy.set(run.policy, policyWins / policyRuns.length);
    }
  }

  const winRates = Array.from(policyWinRatesByPolicy.values());
  const meanWinRate = winRates.reduce((sum, r) => sum + r, 0) / winRates.length;
  const variance = winRates.reduce((sum, r) => sum + Math.pow(r - meanWinRate, 2), 0) / winRates.length;
  const normalizedPolicyVariance = meanWinRate > 0 ? variance / meanWinRate : 0;

  // Decision impact: optimal (greedy) vs suboptimal (imperfect-human)
  const greedyRuns = runs.filter(r => r.policy === 'greedy');
  const imperfectHumanRuns = runs.filter(r => r.policy === 'imperfect-human');

  const greedyWinRate = greedyRuns.length > 0 ? greedyRuns.filter(r => r.victory).length / greedyRuns.length : 0;
  const imperfectHumanWinRate = imperfectHumanRuns.length > 0
    ? imperfectHumanRuns.filter(r => r.victory).length / imperfectHumanRuns.length
    : 0;

  const decisionImpact = {
    delta: greedyWinRate - imperfectHumanWinRate,
    baseline: greedyWinRate,
  };

  // Behavior effectiveness by policy
  const behaviorEffectivenessByPolicy = new Map<PolicyId, BehaviorEffectivenessRecord[]>();
  for (const run of runs) {
    if (!behaviorEffectivenessByPolicy.has(run.policy)) {
      behaviorEffectivenessByPolicy.set(run.policy, []);
    }

    const records = behaviorEffectivenessByPolicy.get(run.policy)!;

    // Accumulate behavior stats
    for (const effectiveness of run.behaviorEffectiveness) {
      const existing = records.find(r => r.behaviorId === effectiveness.behaviorId);
      if (existing) {
        existing.encounterCount++;
        existing.avgDamageTaken = (existing.avgDamageTaken * (existing.encounterCount - 1) + effectiveness.avgDamageTaken) / existing.encounterCount;
        existing.avgTurnsToKill = (existing.avgTurnsToKill * (existing.encounterCount - 1) + effectiveness.avgTurnsToKill) / existing.encounterCount;
        // Win rate update would require storing individual encounter outcomes
      } else {
        records.push({
          ...effectiveness,
          encounterCount: 1,
        });
      }
    }
  }

  return {
    earlyWinRate,
    midWinRate,
    lateWinRate,
    avgTurnsPerWin,
    avgHpRemainingOnWin,
    burstDeathRate,
    burstDeathsBySource,
    attritionDeathRate,
    steamrollRate,
    staleFightRate,
    consumableUsageRate,
    comebackRate,
    avgComebackStrength,
    avgComebackCount,
    normalizedPolicyVariance,
    policyWinRatesByPolicy,
    decisionImpact,
    behaviorEffectivenessByPolicy,
  };
}
