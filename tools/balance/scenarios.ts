import type { ScenarioSeeds } from './types.js';

/**
 * Scenario definition: environment, enemies, and seed pools for testing balance.
 */
export interface Scenario {
  readonly id: string;
  readonly startDepth: number;
  readonly maxFloors: number;
  readonly preferredBiomes?: string[];
  readonly preferredArchetypes?: string[];
  readonly evaluationSeeds: number[];
  readonly explorationSeeds: number[];
  readonly rotatingSeedPoolSize: number;
}

/**
 * Generate all scenarios for testing. Each scenario targets specific challenge vectors.
 */
export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'early-cave',
    startDepth: 1,
    maxFloors: 3,
    preferredBiomes: ['cave'],
    preferredArchetypes: ['aggressive_melee'],
    evaluationSeeds: Array.from({ length: 25 }, (_, i) => 1000 + i),
    explorationSeeds: Array.from({ length: 5 }, (_, i) => 1100 + i),
    rotatingSeedPoolSize: 5,
  },
  {
    id: 'mid-frost',
    startDepth: 4,
    maxFloors: 3,
    preferredBiomes: ['frost'],
    preferredArchetypes: ['skittish_ranged', 'cautious_defensive'],
    evaluationSeeds: Array.from({ length: 25 }, (_, i) => 2000 + i),
    explorationSeeds: Array.from({ length: 5 }, (_, i) => 2100 + i),
    rotatingSeedPoolSize: 5,
  },
  {
    id: 'late-swamp-boss',
    startDepth: 7,
    maxFloors: 1,
    preferredBiomes: ['swamp'],
    preferredArchetypes: ['ambusher', 'hazard_creator'],
    evaluationSeeds: Array.from({ length: 25 }, (_, i) => 3000 + i),
    explorationSeeds: Array.from({ length: 5 }, (_, i) => 3100 + i),
    rotatingSeedPoolSize: 5,
  },
  {
    id: 'burst-encounter',
    startDepth: 3,
    maxFloors: 1,
    preferredBiomes: ['cave'],
    preferredArchetypes: ['aggressive_melee', 'ambusher'],
    evaluationSeeds: Array.from({ length: 25 }, (_, i) => 4000 + i),
    explorationSeeds: Array.from({ length: 5 }, (_, i) => 4100 + i),
    rotatingSeedPoolSize: 5,
  },
  {
    id: 'multi-floor-prog',
    startDepth: 1,
    maxFloors: 6,
    preferredBiomes: ['cave', 'frost', 'swamp'],
    // No preferred archetypes: mixed
    evaluationSeeds: Array.from({ length: 25 }, (_, i) => 5000 + i),
    explorationSeeds: Array.from({ length: 5 }, (_, i) => 5100 + i),
    rotatingSeedPoolSize: 5,
  },
  {
    id: 'chaos-mixed',
    startDepth: 1,
    maxFloors: 5,
    // No preferredBiomes or preferredArchetypes — fully random
    evaluationSeeds: Array.from({ length: 25 }, (_, i) => 6000 + i),
    explorationSeeds: Array.from({ length: 5 }, (_, i) => 6100 + i),
    rotatingSeedPoolSize: 5,
  },
];

/**
 * Get a scenario by ID.
 */
export function getScenarioById(id: string): Scenario {
  const scenario = SCENARIOS.find(s => s.id === id);
  if (!scenario) throw new Error(`Unknown scenario: ${id}`);
  return scenario;
}

/**
 * Get the next exploration seed for a scenario, rotating if necessary.
 */
export function getNextExplorationSeed(scenario: Scenario, generationNumber: number): number {
  const poolSize = scenario.rotatingSeedPoolSize;
  const index = (generationNumber - 1) % poolSize;
  return scenario.explorationSeeds[index] ?? scenario.explorationSeeds[0]!;
}
