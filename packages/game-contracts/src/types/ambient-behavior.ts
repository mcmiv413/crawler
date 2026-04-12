export type AmbientState =
  | 'idle'
  | 'roaming'
  | 'regrouping'
  | 'hiding'
  | 'guarding'
  | 'patrolling'
  | 'stalking'
  | 'returning_to_anchor'
  | 'dormant';

export interface TilePreferences {
  readonly wallAdjacency?: number; // proximity to walls (0-1)
  readonly doorwayProximity?: number; // proximity to doorways
  readonly darkness?: number; // prefer shadowed/unseen tiles
  readonly sameSpeciesProximity?: number; // social: cluster with same archetype
  readonly otherEnemyAvoidance?: number; // social: distance from other enemies
  readonly playerLastSeenDistance?: number; // avoid or approach last sighting
  readonly openSpace?: number; // prefer spacious tiles
  readonly nestedCells?: number; // prefer enclosed/safe tiles
}

export interface StateTransitionRule {
  readonly from: AmbientState;
  readonly to: AmbientState;
  readonly trigger: 'time_elapsed' | 'ally_nearby' | 'no_allies' | 'disturbance_heard' | 'random_wander';
  readonly cooldownTurns?: number;
  readonly probability?: number; // for 'random_wander' trigger
}

export interface AmbientBehaviorProfile {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly defaultState: AmbientState;

  // Tile scoring for action selection
  readonly tilePreferences: TilePreferences;

  // Social dynamics
  readonly groupMinSize?: number; // min enemies to trigger regrouping
  readonly groupMaxSize?: number; // max size before scattering
  readonly socialRadius?: number; // range for social clustering (default 5)
  readonly speciesPreference?: 'same' | 'mixed' | 'solitary'; // social affinity

  // Territory
  readonly anchorRadius?: number; // max distance from spawn before returning
  readonly guardsRange?: number; // detection range for 'guarding' state

  // Behavior tuning
  readonly wanderIntensity?: number; // 0-1: randomness in roaming (default 0.3)
  readonly alertness?: number; // 0-1: how quick to investigate sounds
  readonly panicThreshold?: number; // 0-1: HP ratio to flee

  // State machine
  readonly stateTransitions: readonly StateTransitionRule[];
}
