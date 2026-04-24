import type { AmbientBehaviorProfile } from '@dungeon/contracts';

/**
 * Wanderer Profile: Skeleton Warrior archetype
 * Aimless drift, weak social preference, weak terrain preference
 * Result: scattered, disorganized encounters
 */
export const WANDERER_PROFILE: AmbientBehaviorProfile = {
  id: 'wanderer',
  name: 'Wanderer',
  description: 'Aimless wandering with no social preference or terrain mastery',
  defaultState: 'roaming',
  tilePreferences: {
    wallAdjacency: 0,
    doorwayProximity: 0,
    sameSpeciesProximity: 0.1, // weak clustering
    openSpace: 0.3,
  },
  wanderIntensity: 0.7, // very random
  speciesPreference: 'solitary',
  stateTransitions: [
    {
      from: 'roaming',
      to: 'idle',
      trigger: 'time_elapsed',
      cooldownTurns: 3,
      probability: 0.2,
    },
    {
      from: 'idle',
      to: 'roaming',
      trigger: 'random_wander',
    },
  ],
};

export const wanderer = WANDERER_PROFILE;
