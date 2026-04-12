import type { BalanceConfig } from '@dungeon/contracts';
import type { RNG } from '@dungeon/contracts';
import { createDefaultBalanceConfig } from '@dungeon/content';
import { COMBAT_BOUNDS, FLOOR_SCALING_BOUNDS, isWithinBounds } from './constraints.js';

/**
 * Mutation parameters: how aggressive to mutate values in each generation.
 */
export interface MutationParams {
  maxStepPct: number; // Max % change per mutation (e.g. 0.05 = ±5%)
  maxChangesPerCandidate: number; // Max number of mutations per candidate
  explorationChance: number; // [0.0-1.0]: chance of larger exploration step
  explorationStepMultiplier: number; // How much larger (e.g. 3x)
}

/**
 * Phase-gated mutation allowlist: controls which parameters are mutable per generation.
 */
export interface PhaseGate {
  generation: number; // Generations at and after this are unlocked
  allowedPaths: string[]; // e.g. 'combat.defenseDivisor'
}

const DEFAULT_CONFIG = createDefaultBalanceConfig();

const PHASE_GATES: readonly PhaseGate[] = [
  {
    generation: 1,
    allowedPaths: [
      'combat.baseHitChance',
      'combat.minHitChance',
      'combat.maxHitChance',
      'combat.critChance',
      'combat.critMultiplier',
      'combat.damageVariance',
      'combat.defenseDivisor',
      'combat.minDamage',
    ],
  },
  {
    generation: 6,
    allowedPaths: [
      'combat.baseHitChance',
      'combat.minHitChance',
      'combat.maxHitChance',
      'combat.critChance',
      'combat.critMultiplier',
      'combat.damageVariance',
      'combat.defenseDivisor',
      'combat.minDamage',
      'floorScaling.healthMultiplier',
      'floorScaling.attackMultiplier',
      'floorScaling.defenseMultiplier',
      'floorScaling.experienceMultiplier',
    ],
  },
  // Generation 16+: would add mapGeneration.enemyBaseDensity but that's not in BalanceConfig per plan
];

/**
 * Get value at path in nested object.
 */
function getValueAtPath(obj: unknown, path: string): unknown {
  const keys = path.split('.');
  let current = obj;
  for (const key of keys) {
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Set value at path in nested object, returning new object.
 */
function setValueAtPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const keys = path.split('.');
  const lastKey = keys.pop()!;
  const mutableCopy = JSON.parse(JSON.stringify(obj)) as Record<string, unknown>;

  let current = mutableCopy;
  for (const key of keys) {
    if (!(current[key] !== null && typeof current[key] === 'object')) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[lastKey] = value;
  return mutableCopy;
}

/**
 * Get allowed paths for a given generation.
 */
function getAllowedPathsForGeneration(generation: number): string[] {
  const gate = PHASE_GATES.reduce((best, g) => (g.generation <= generation && g.generation > best.generation ? g : best), PHASE_GATES[0]!);
  return gate.allowedPaths;
}

/**
 * Mutate a config by randomly changing some parameters.
 * Returns a new config with mutations applied.
 */
export function mutateConfig(
  baseConfig: BalanceConfig,
  rng: RNG,
  params: MutationParams,
  generation: number,
): BalanceConfig {
  const allowedPaths = getAllowedPathsForGeneration(generation);
  if (allowedPaths.length === 0) {
    return baseConfig; // No paths available yet
  }

  // Decide how many mutations
  const numMutations = rng.int(1, Math.min(params.maxChangesPerCandidate, allowedPaths.length));

  // Pick paths to mutate
  const mutablePaths: string[] = [];
  for (let i = 0; i < numMutations; i++) {
    const path = allowedPaths[rng.int(0, allowedPaths.length - 1)]!;
    if (!mutablePaths.includes(path)) {
      mutablePaths.push(path);
    }
  }

  // Create new config with mutations
  let mutated: unknown = baseConfig;

  for (const path of mutablePaths) {
    // Determine step size (explore vs refine)
    let stepPct = params.maxStepPct;
    if (rng.chance(params.explorationChance * 100)) {
      // Exploration step
      stepPct *= params.explorationStepMultiplier;
    }

    // Get current value
    const current = getValueAtPath(mutated, path);

    if (typeof current !== 'number') {
      continue; // Skip non-numeric
    }

    // Mutate: random direction
    const direction = rng.chance(50) ? 1 : -1;
    const changeAmount = current * stepPct * direction;
    const newValue = current + changeAmount;

    // Check bounds
    const allBounds = { COMBAT_BOUNDS, FLOOR_SCALING_BOUNDS };
    const boundsCheck = isWithinBounds(path, newValue, allBounds as unknown as Record<string, Record<string, { min: number; max: number }>>) ;
    if (boundsCheck === false) {
      continue; // Skip out-of-bounds
    }

    // Apply mutation
    mutated = setValueAtPath(mutated as Record<string, unknown>, path, newValue);
  }

  return mutated as BalanceConfig;
}

/**
 * Generate a candidate by mutating the current best config.
 * If exploration step is selected, performs a larger single mutation.
 */
export function generateCandidate(
  bestConfig: BalanceConfig,
  rng: RNG,
  params: MutationParams,
  generation: number,
): BalanceConfig {
  return mutateConfig(bestConfig, rng, params, generation);
}
