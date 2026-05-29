/**
 * Built-in Three.js effect registry.
 *
 * Registers all shipped effect modules and exports the canonical list of
 * animation IDs so contract tests can validate them against live content.
 */

import { register } from '../three-effect-registry.js';
import { healingPulseEffect } from './healing-pulse-effect.js';
import { animationRefs } from '@dungeon/content';

const HEALING_PULSE_ID = animationRefs.self.healingPulse.id;

register(HEALING_PULSE_ID, healingPulseEffect);

/** All animation IDs that have a registered Three.js effect module. */
export const BUILT_IN_THREE_EFFECT_IDS: readonly string[] = [
  HEALING_PULSE_ID,
];
