import type { AmbientBehaviorProfile } from '@dungeon/contracts';

/**
 * Wall Lurker Profile: Pit Spider archetype
 * Prefer wall-adjacent, doorway-adjacent tiles; wait for prey
 * Result: spiders settle into ambush positions
 */
export const WALL_LURKER_PROFILE: AmbientBehaviorProfile = {
  id: 'wall_lurker',
  name: 'Wall Lurker',
  description: 'Seeks shadowed corners and wall-adjacent hiding spots for ambush',
  defaultState: 'hiding',
  tilePreferences: {
    wallAdjacency: 0.8,
    doorwayProximity: 0.6,
    darkness: 0.5,
    otherEnemyAvoidance: 0.5,
  },
  wanderIntensity: 0.1, // very deliberate
  anchorRadius: 7,
  speciesPreference: 'solitary',
  stateTransitions: [
    {
      from: 'hiding',
      to: 'stalking',
      trigger: 'disturbance_heard',
    },
    {
      from: 'stalking',
      to: 'hiding',
      trigger: 'random_wander',
      probability: 0.3,
    },
  ],
};

export const wallLurker = WALL_LURKER_PROFILE;
