import type { AggregateMetrics, BalanceRecommendation } from './types.js';

/**
 * Generate tuning recommendations based on metrics.
 * Each recommendation includes confidence based on sample size and signal strength.
 */
export function recommendTuning(metrics: AggregateMetrics): BalanceRecommendation[] {
  const recommendations: BalanceRecommendation[] = [];

  // ─────────────────────────────────────────────────────────────────
  // Burst damage detection
  // ─────────────────────────────────────────────────────────────────

  if (metrics.burstDeathRate > 0.20) {
    const src = metrics.burstDeathsBySource;
    const total = src.ability_spike + src.single_enemy + src.multi_focus;

    // Identify primary cause
    if (src.ability_spike > src.single_enemy && src.ability_spike > src.multi_focus) {
      recommendations.push({
        cause: 'Enemy ability spikes causing burst deaths',
        suggestion: { path: 'combat.defenseDivisor', change: '+5%' },
        confidence: src.ability_spike / Math.max(1, total),
      });
    }

    if (src.multi_focus > src.single_enemy) {
      recommendations.push({
        cause: 'Enemy clustering / focus fire causing burst deaths',
        suggestion: { path: 'mapGeneration.enemyBaseDensity', change: '-1' },
        confidence: src.multi_focus / Math.max(1, total),
        flagLowSample: true, // mapGeneration not in BalanceConfig yet
      });
    }

    if (src.single_enemy > 0) {
      recommendations.push({
        cause: 'Raw burst damage from single enemies',
        suggestion: { path: 'combat.damageVariance', change: '-8%' },
        confidence: 0.5,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Win rate out of bounds
  // ─────────────────────────────────────────────────────────────────

  if (metrics.earlyWinRate < 0.30) {
    recommendations.push({
      cause: 'Early game too difficult',
      suggestion: { path: 'floorScaling.healthMultiplier', change: '-10%' },
      confidence: 0.7,
    });
  }

  if (metrics.earlyWinRate > 0.80) {
    recommendations.push({
      cause: 'Early game too easy',
      suggestion: { path: 'combat.damageVariance', change: '+10%' },
      confidence: 0.6,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Engagement (tension)
  // ─────────────────────────────────────────────────────────────────

  if (metrics.avgHpRemainingOnWin < 0.15) {
    recommendations.push({
      cause: 'Player health too low on wins (dying too consistently)',
      suggestion: { path: 'combat.defenseDivisor', change: '+8%' },
      confidence: 0.65,
    });
  }

  if (metrics.avgHpRemainingOnWin > 0.80) {
    recommendations.push({
      cause: 'Player health too high on wins (steamrolling)',
      suggestion: { path: 'floorScaling.attackMultiplier', change: '+5%' },
      confidence: 0.65,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Combat pacing
  // ─────────────────────────────────────────────────────────────────

  if (metrics.avgTurnsPerWin < 20) {
    recommendations.push({
      cause: 'Fights too short (lacks engagement)',
      suggestion: { path: 'floorScaling.healthMultiplier', change: '+5%' },
      confidence: 0.6,
    });
  }

  if (metrics.avgTurnsPerWin > 100) {
    recommendations.push({
      cause: 'Fights too long (grinding)',
      suggestion: { path: 'floorScaling.attackMultiplier', change: '+8%' },
      confidence: 0.65,
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // Behavior effectiveness
  // ─────────────────────────────────────────────────────────────────

  for (const [policy, records] of metrics.behaviorEffectivenessByPolicy) {
    for (const rec of records) {
      const confidence = Math.min(rec.encounterCount / 20, 1.0); // 20+ encounters = full confidence
      const flagLowSample = rec.encounterCount < 10;

      // Behavior too weak
      if (rec.winRate > 0.85 && rec.avgTurnsToKill < 5) {
        recommendations.push({
          cause: `${rec.behaviorId} may be too weak against ${policy} (${rec.encounterCount} encounters)`,
          suggestion: { path: `archetype.${rec.behaviorId}.statMultiplier`, change: '+10%' },
          confidence,
          flagLowSample,
        });
      }

      // Behavior too strong
      if (rec.winRate < 0.15 && rec.encounterCount >= 5) {
        recommendations.push({
          cause: `${rec.behaviorId} may be too strong against ${policy} (${rec.encounterCount} encounters)`,
          suggestion: { path: `archetype.${rec.behaviorId}.statMultiplier`, change: '-10%' },
          confidence,
          flagLowSample,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────
  // Agency / decision impact
  // ─────────────────────────────────────────────────────────────────

  const { baseline, delta } = metrics.decisionImpact;
  if (baseline < 0.25 && delta > 0.20) {
    recommendations.push({
      cause: 'Game too hard: even optimal play is struggling',
      suggestion: { path: 'floorScaling.healthMultiplier', change: '-15%' },
      confidence: 0.8,
    });
  }

  if (baseline > 0.80 && delta < 0.05) {
    recommendations.push({
      cause: 'Game too easy: decisions don\'t matter',
      suggestion: { path: 'floorScaling.attackMultiplier', change: '+10%' },
      confidence: 0.75,
    });
  }

  return recommendations;
}
