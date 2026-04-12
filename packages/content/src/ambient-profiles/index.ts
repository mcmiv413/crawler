import type { AmbientBehaviorProfile } from '@dungeon/contracts';
import { WANDERER_PROFILE } from './wanderer.js';
import { WALL_LURKER_PROFILE } from './wall-lurker.js';
import { SWARMER_PROFILE } from './swarmer.js';

export const AMBIENT_PROFILES = new Map<string, AmbientBehaviorProfile>([
  [WANDERER_PROFILE.id, WANDERER_PROFILE],
  [WALL_LURKER_PROFILE.id, WALL_LURKER_PROFILE],
  [SWARMER_PROFILE.id, SWARMER_PROFILE],
]);

export { WANDERER_PROFILE, WALL_LURKER_PROFILE, SWARMER_PROFILE };
