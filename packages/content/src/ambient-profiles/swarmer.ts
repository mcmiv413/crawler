import type { AmbientBehaviorProfile } from '@dungeon/contracts';

/**
 * Swarmer Profile: Cave Rat archetype
 * Cluster with same species, low courage, avoid larger creatures
 * Result: rats form tight groups, scatter and reform
 */
export const SWARMER_PROFILE: AmbientBehaviorProfile = {
  id: 'swarmer',
  name: 'Swarmer',
  description: 'Seeks safety in numbers, clustering tightly with other swarmers',
  defaultState: 'regrouping',
  tilePreferences: {
    sameSpeciesProximity: 0.9, // strong clustering
    otherEnemyAvoidance: 0.7,
    darkness: 0.2,
  },
  groupMinSize: 3,
  groupMaxSize: 7,
  wanderIntensity: 0.4,
  speciesPreference: 'same',
  socialRadius: 7,
  stateTransitions: [
    {
      from: 'regrouping',
      to: 'roaming',
      trigger: 'ally_nearby',
      cooldownTurns: 2,
    },
    {
      from: 'roaming',
      to: 'regrouping',
      trigger: 'no_allies',
    },
  ],
};
