import type { AggregateMetrics } from './types.js';

/**
 * Compute a smooth, continuous score for a balance configuration.
 * Higher scores indicate better balance.
 *
 * All functions are continuous (no flat bands) to enable gradient-based optimization.
 * Comeback metrics are capped to prevent gaming the score through chaos.
 */
export function scoreMetrics(metrics: AggregateMetrics): number {
  let score = 0;

  // ─────────────────────────────────────────────────────────────────
  // Win rates — target 0.55 early, 0.50 mid, 0.45 late (harder as game progresses)
  // Smooth quadratic penalty for deviation
  // ─────────────────────────────────────────────────────────────────

  const earlyDeviation = (metrics.earlyWinRate - 0.55) / 0.30;
  score += -Math.pow(earlyDeviation, 2) * 20;

  const midDeviation = (metrics.midWinRate - 0.50) / 0.30;
  score += -Math.pow(midDeviation, 2) * 20;

  const lateDeviation = (metrics.lateWinRate - 0.45) / 0.30;
  score += -Math.pow(lateDeviation, 2) * 20;

  // ─────────────────────────────────────────────────────────────────
  // Tension: HP remaining on win (target 0.40 = moderate engagement)
  // Too low = dying consistently; too high = steamrolling
  // ─────────────────────────────────────────────────────────────────

  const tension = metrics.avgHpRemainingOnWin;
  if (tension < 0.15) {
    // Dying too consistently
    score -= 30;
  } else if (tension > 0.80) {
    // Steamrolling
    score -= 20;
  } else {
    // Reward proximity to target
    const proximityReward = 10 * (1 - Math.abs(tension - 0.40) / 0.35);
    score += proximityReward;
  }

  // ─────────────────────────────────────────────────────────────────
  // Bad signals: burst, steamroll, stale fights
  // ─────────────────────────────────────────────────────────────────

  score -= metrics.burstDeathRate * 40; // Burst is high-priority bad
  score -= metrics.steamrollRate * 25; // Trivial is bad but less critical
  score -= metrics.staleFightRate * 20; // Grindy is bad

  // ─────────────────────────────────────────────────────────────────
  // Comebacks — CAP at 0.4 to prevent optimizer gaming
  // Weighted strength means shallow dips (0.18 HP) are worth less than clutch 0.05 HP recoveries
  // ─────────────────────────────────────────────────────────────────

  const cappedComebackRate = Math.min(metrics.comebackRate, 0.40);
  score += cappedComebackRate * 15;

  const cappedComebackStrength = Math.min(metrics.avgComebackStrength, 0.5);
  score += cappedComebackStrength * 10;

  // ─────────────────────────────────────────────────────────────────
  // Agency — use NORMALIZED variance (variance / mean) to avoid confusing skill gaps with broken builds
  // Hard-penalize if any policy is extreme (< 10% or > 90% win rate = broken)
  // ─────────────────────────────────────────────────────────────────

  const normalizedVariance = metrics.normalizedPolicyVariance;
  const extremePolicy = Array.from(metrics.policyWinRatesByPolicy.values()).some(
    r => r < 0.10 || r > 0.90,
  );

  if (extremePolicy) {
    // Extreme = broken, not skillful
    score -= 20;
  } else if (normalizedVariance < 0.05) {
    // All policies same = trivial (no meaningful decisions)
    score -= 10;
  } else if (normalizedVariance > 0.60) {
    // Too wide = unhealthy skill gap
    score -= 10;
  } else {
    // Healthy variance = meaningful agency
    score += 8;
  }

  // ─────────────────────────────────────────────────────────────────
  // Decision impact — penalize bad combinations (not just delta)
  // Healthy: high baseline + moderate delta = decisions matter in a playable game
  // Broken: low baseline + high delta = unplayably hard
  // Trivial: high baseline + low delta = too easy
  // ─────────────────────────────────────────────────────────────────

  const { baseline, delta } = metrics.decisionImpact;

  if (baseline < 0.25 && delta > 0.20) {
    // Unplayably hard: even optimal play is failing
    score -= 15;
  } else if (baseline > 0.80 && delta < 0.05) {
    // Trivially easy: decisions don't matter
    score -= 10;
  } else if (baseline >= 0.35 && baseline <= 0.75 && delta >= 0.10 && delta <= 0.35) {
    // Healthy agency: moderate baseline, meaningful decision impact
    score += 10;
  }

  return score;
}
