/**
 * Built-in Three.js effect registry.
 *
 * Registers all shipped effect modules and exports the canonical list of
 * animation IDs so contract tests can validate them against live content.
 */

import { animationRefs, type AnimationId } from '@dungeon/content';
import { register } from '../three-effect-registry.js';
import type { ThreeEffectModule } from '../three-effect-types.js';
import { healingPulseEffect } from './healing-pulse-effect.js';
export { BUILT_IN_THREE_EFFECT_IDS } from '../../three-effect-metadata.js';

interface BuiltInThreeEffectRegistration {
  readonly animationId: AnimationId;
  readonly module: ThreeEffectModule;
}

const HEALING_PULSE_ID = animationRefs.self.healingPulse.id;

// Metadata must stay outside apps/web/src/rendering/three so the flag-off path
// can remain lightweight. Keep this duplicate registration list guarded by
// contract tests instead of relying on convention.
export const BUILT_IN_THREE_EFFECT_REGISTRATIONS: readonly BuiltInThreeEffectRegistration[] = [
  {
    animationId: HEALING_PULSE_ID,
    module: healingPulseEffect,
  },
];

export function registerBuiltInThreeEffects(): readonly AnimationId[] {
  for (const { animationId, module } of BUILT_IN_THREE_EFFECT_REGISTRATIONS) {
    register(animationId, module);
  }

  return BUILT_IN_THREE_EFFECT_REGISTRATIONS.map(({ animationId }) => animationId);
}

registerBuiltInThreeEffects();
