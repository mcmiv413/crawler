import type { PolicyId } from './policies.js';

/**
 * Fixed vs rotating seed strategy for scenario evaluation.
 * Evaluation seeds determine score; exploration seeds validate but don't affect ranking.
 */
export interface ScenarioSeeds {
  evaluationSeeds: number[];
  explorationSeeds: number[];
}

/**
 * Per-encounter telemetry: enemy performance and damage attribution.
 */
export interface EncounterStat {
  enemyId: string;
  enemyTemplateId: string;
  enemyArchetype: string; // aggressive_melee, skittish_ranged, cautious_defensive, ambusher, hazard_creator
  movementBehaviorId: string | null;
  ambientBehaviorProfile: string | null;

  turns: number;
  damageTaken: number;

  timeToFirstHit: number; // turns from ENEMY_ALERTED to first hit on player
  maxDamageInThreeTurnWindow: number; // highest rolling-3-turn damage taken

  // Burst source attribution (tighter thresholds)
  burstSource: 'single_enemy' | 'multi_focus' | 'ability_spike' | null;
  // single_enemy:  top attacker dealt > 60% of burst damage
  // multi_focus:   top 2 attackers combined > 80% of burst (catches 40%+40% edge case)
  // ability_spike: burst window overlaps ABILITY_USED by enemy (takes priority over above)
}

/**
 * Deep near-death recovery event.
 */
export interface ComebackEvent {
  lowestHpPct: number; // lowest HP reached before recovery (e.g. 0.12)
  recoveredHpPct: number; // HP at end of run / maxHP (e.g. 0.55)
  recoveryTurns: number; // turns from lowest HP to safe (>40% HP)
}

/**
 * Run-level telemetry: outcomes, engagement metrics, behaviors.
 */
export interface RunTelemetry {
  scenarioId: string;
  seed: number;
  seedType: 'evaluation' | 'exploration';
  policy: PolicyId;

  victory: boolean;
  floorReached: number;
  turns: number;

  damageDealt: number;
  damageTaken: number;
  playerHpStart: number;
  playerHpEnd: number;

  consumablesUsed: number;
  nearDeathMoments: number; // turns where HP < 20%
  turnsAtLowHp: number;

  // Comeback (replaces boolean)
  comebackEvents: ComebackEvent[];
  comebackCount: number;
  // Weighted comeback strength: strength * (1 - lowestHpPct)
  // Deep near-death (0.05 HP) matters more than shallow dips (0.18 HP)
  comebackStrength: number; // avg of weighted comeback = (recovered - lowest) * (1 - lowest)

  deaths: number;
  causeOfDeath?: string;

  encounterStats: EncounterStat[];

  // Behavior effectiveness per encounter
  behaviorEffectiveness: BehaviorEffectivenessRecord[];
}

/**
 * Enemy behavior audit: how well archetypes perform against policies.
 */
export interface BehaviorEffectivenessRecord {
  behaviorId: string; // archetype or movementBehaviorId
  policy: PolicyId;
  encounterCount: number; // REQUIRED: if < 10, stats are unreliable — flag in report
  winRate: number; // did player win encounters against this behavior?
  avgDamageTaken: number;
  avgTurnsToKill: number;
}

/**
 * Aggregate metrics across all runs for a generation.
 */
export interface AggregateMetrics {
  // Win rates by floor tier
  earlyWinRate: number;
  midWinRate: number;
  lateWinRate: number;

  // Engagement metrics
  avgTurnsPerWin: number;
  avgHpRemainingOnWin: number; // HP / maxHP

  // Danger signals
  burstDeathRate: number;
  burstDeathsBySource: {
    single_enemy: number;
    multi_focus: number;
    ability_spike: number;
  };
  attritionDeathRate: number;
  steamrollRate: number; // % of runs with >80% HP remaining
  staleFightRate: number; // % of runs with >100 turns

  // Consumption patterns
  consumableUsageRate: number;

  // Comeback (richer, depth-weighted)
  comebackRate: number; // % of runs with ≥1 comeback
  avgComebackStrength: number; // avg weighted comeback = (recovered - lowest) * (1 - lowest)
  avgComebackCount: number; // avg comebacks per run

  // Agency — normalized to avoid treating skill gaps and broken builds the same
  normalizedPolicyVariance: number; // variance(winRates) / mean(winRates)
  policyWinRatesByPolicy: Map<PolicyId, number>; // raw per-policy win rates
  // Penalized if any single policy < 10% or > 90% win rate (extreme = broken)

  // Decision impact: both delta AND baseline context
  decisionImpact: {
    delta: number; // greedyWinRate - imperfectHumanWinRate
    baseline: number; // greedyWinRate (context for interpreting delta)
    // Healthy: high baseline + moderate delta
    // Bad: low baseline + high delta (unplayably hard) OR high baseline + zero delta (trivially easy)
  };

  // Enemy behavior audit
  behaviorEffectivenessByPolicy: Map<PolicyId, BehaviorEffectivenessRecord[]>;
}

/**
 * Recommendation: what to tune based on metrics.
 */
export interface BalanceRecommendation {
  cause: string;
  suggestion: {
    path: string; // e.g. 'combat.defenseDivisor'
    change: string; // e.g. '+5%' or '-10'
  };
  confidence: number; // [0.0-1.0]
  flagLowSample?: boolean; // true if encounterCount < 10
}

/**
 * Scoring result for a generation: metrics + score + recommendations.
 */
export interface GenerationScore {
  generation: number;
  metrics: AggregateMetrics;
  score: number;
  isConstraintPassed: boolean;
  constraintFailureReason?: string;
  recommendations: BalanceRecommendation[];
}
