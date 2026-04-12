import type { AggregateMetrics } from './types.js';

/**
 * Hard constraints that reject a candidate balance config if violated.
 * These represent game-breaking conditions that must never be allowed.
 */
export interface ConstraintResult {
  passed: boolean;
  reason?: string;
}

/**
 * Check hard constraints on aggregate metrics.
 * Returns false if any constraint is violated.
 */
export function checkConstraints(metrics: AggregateMetrics): ConstraintResult {
  // Burst death rate too high
  if (metrics.burstDeathRate > 0.30) {
    return {
      passed: false,
      reason: `burstDeathRate ${(metrics.burstDeathRate * 100).toFixed(1)}% exceeds 30% threshold`,
    };
  }

  // Turns per win too low or too high (indicates trivial or broken)
  if (metrics.avgTurnsPerWin < 15) {
    return {
      passed: false,
      reason: `avgTurnsPerWin ${metrics.avgTurnsPerWin.toFixed(1)} is too low (trivial)`,
    };
  }
  if (metrics.avgTurnsPerWin > 120) {
    return {
      passed: false,
      reason: `avgTurnsPerWin ${metrics.avgTurnsPerWin.toFixed(1)} is too high (broken)`,
    };
  }

  // Early game win rate boundaries
  if (metrics.earlyWinRate < 0.20) {
    return {
      passed: false,
      reason: `earlyWinRate ${(metrics.earlyWinRate * 100).toFixed(1)}% is too low (<20%)`,
    };
  }
  if (metrics.earlyWinRate > 0.90) {
    return {
      passed: false,
      reason: `earlyWinRate ${(metrics.earlyWinRate * 100).toFixed(1)}% is too high (>90%)`,
    };
  }

  // Policy variance sanity: check for extreme policies (broken < 10% or > 90%)
  const extremePolicies = Array.from(metrics.policyWinRatesByPolicy.values()).filter(
    r => r < 0.10 || r > 0.90,
  );
  if (extremePolicies.length > 0) {
    return {
      passed: false,
      reason: `${extremePolicies.length} policy/policies are extreme (< 10% or > 90% win rate = broken)`,
    };
  }

  return { passed: true };
}

/**
 * Check if a single-value mutation is within absolute bounds.
 * Prevents nonsensical parameter combinations.
 */
export interface MutationBounds {
  [key: string]: { min: number; max: number };
}

export const COMBAT_BOUNDS: MutationBounds = {
  critChance: { min: 0.01, max: 0.25 },
  defenseDivisor: { min: 20, max: 100 },
  damageVariance: { min: 0.05, max: 0.40 },
  baseHitChance: { min: 40, max: 100 },
  minHitChance: { min: 5, max: 40 },
  maxHitChance: { min: 50, max: 100 },
  critMultiplier: { min: 1.1, max: 3.0 },
  minDamage: { min: 0.5, max: 5 },
};

export const FLOOR_SCALING_BOUNDS: MutationBounds = {
  healthMultiplier: { min: 1.05, max: 1.50 },
  attackMultiplier: { min: 1.05, max: 1.50 },
  defenseMultiplier: { min: 1.05, max: 1.50 },
  experienceMultiplier: { min: 0.8, max: 1.5 },
};

/**
 * Check if a value is within absolute bounds.
 */
export function isWithinBounds(path: string, value: number, allBounds: Record<string, MutationBounds>): boolean {
  // Extract the parameter name from path (e.g., "combat.defenseDivisor" -> "defenseDivisor")
  const paramName = path.split('.').pop() ?? '';

  // Check all bound categories
  for (const bounds of Object.values(allBounds)) {
    const bound = bounds[paramName];
    if (bound) {
      return value >= bound.min && value <= bound.max;
    }
  }

  // If not found in bounds, allow it (unknown parameter)
  return true;
}
