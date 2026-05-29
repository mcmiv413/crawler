/**
 * Type contracts for the generalized Three.js animation module system.
 *
 * ThreeAnimationModule<TInstance> extends ThreeEffectModule with:
 *   - id        — the AnimationId this module handles (sourced from animationRefs)
 *   - category  — the AnimationCategory (impact | projectile | self | aoe | status | utility)
 *
 * These types are renderer-light: no Three.js imports, so unit tests and
 * registry code can run without a WebGL context.
 *
 * Overlay coordinate contract
 * ---------------------------
 * Module methods receive screen-space pixel positions already converted from
 * tile-world coordinates by ThreeAnimationOverlay. For projectile-like modules,
 * the position can also include optional `source` and `target` screen-space
 * points so modules can interpolate travel from actor to defender instead of
 * only anchoring at the impact tile. The overlay owns the single y-axis flip
 * point (game y+ = down → Three y+ = up); modules must NOT perform an
 * additional y-flip.
 */

import type { AnimationId, AnimationCategory } from '@dungeon/content';
import type { ThreeEffectContext, ThreeEffectScreenPosition } from './three-effect-types.js';

// Re-export shared context/position types so module authors import from one place.
export type { ThreeEffectContext as ThreeAnimationContext, ThreeEffectScreenPosition as ThreeAnimationPosition };

/**
 * Contract every Three animation module must satisfy.
 *
 * TInstance is the opaque handle returned by create() and passed to all other
 * methods. The overlay holds instances in a Map<animationKey, TInstance>.
 */
export interface ThreeAnimationModule<TInstance = unknown> {
  /** AnimationId this module handles. Must match the registry key. */
  readonly id: AnimationId;
  /** Category sourced from the same animationRef. */
  readonly category: AnimationCategory;
  /** Create and attach a new effect instance to context.scene. */
  create(context: ThreeEffectContext): TInstance;
  /** Move the instance to the given overlay pixel position. */
  setPosition(instance: TInstance, position: ThreeEffectScreenPosition): void;
  /**
   * Advance animation state.
   * @param instance The handle returned by create()
   * @param progress Normalised progress in [0, 1]
   */
  update(instance: TInstance, progress: number): void;
  /** Tear down the instance and release GPU resources. */
  dispose(instance: TInstance): void;
}
