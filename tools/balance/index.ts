/**
 * tools/balance/index.ts — Main balance tuning orchestrator
 *
 * This module ties together the entire balance tuning pipeline:
 * - Scenario definitions (environments, seed pools)
 * - Policies (AI strategies for decision impact measurement)
 * - Simulation (run scenario against policy, collect telemetry)
 * - Aggregation (compute metrics from runs)
 * - Constraints (hard rejects for game-breaking configs)
 * - Scoring (continuous fitness function)
 * - Mutation (generate candidates)
 * - Recommendations (suggest tuning based on metrics)
 *
 * Usage:
 *   tsx tools/balance/index.ts --generations 10 --dry-run
 *   tsx tools/balance/index.ts --generations 50 --seed 42 --output results.json
 */

export type { RunTelemetry, AggregateMetrics, GenerationScore, BalanceRecommendation } from './types.js';
export type { PolicyId } from './policies.js';
export { POLICIES, getPolicyById, decideAction } from './policies.js';
export { SCENARIOS, getScenarioById, getNextExplorationSeed } from './scenarios.js';
export { aggregateMetrics } from './aggregate.js';
export { checkConstraints, COMBAT_BOUNDS, FLOOR_SCALING_BOUNDS, isWithinBounds } from './constraints.js';
export { scoreMetrics } from './scorer.js';
export type { MutationParams, PhaseGate } from './mutator.js';
export { mutateConfig, generateCandidate } from './mutator.js';
export { recommendTuning } from './recommender.js';
