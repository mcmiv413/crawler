/**
 * Animation reference system — catalog of reusable animation tokens with metadata.
 *
 * AnimationId literals may exist only in packages/content/src/animation-refs/.
 * All other consumers (definitions, presenter, web modules, renderer, tests)
 * must reference IDs by dot-walking through the imported animationRefs object.
 */

export type AnimationCategory = 'impact' | 'projectile' | 'self' | 'aoe' | 'status' | 'utility';

/**
 * Animation ID literal type. Enforces fx.<category>.<kebab-name> shape.
 * Example: fx.impact.radial-burst
 */
export type AnimationId = `fx.${AnimationCategory}.${string}`;

/**
 * Animation reference: immutable metadata about an animation.
 * Web modules import these refs to source id, durationMs, category, and suppressActorBump.
 * Definitions dot-walk through animationRefs.<category>.<refName> to declare animation intent.
 */
export interface AnimationRef {
  readonly id: AnimationId;
  readonly category: AnimationCategory;
  readonly durationMs: number;
  /**
   * For projectile and aoe animations: explicitly declare whether this animation
   * suppresses the actor's bump animation when emitted.
   * Default: false. Must be explicitly declared for projectile/aoe refs.
   */
  readonly suppressActorBump?: boolean;
  /**
   * Optional hit-stop duration in milliseconds. When set, the orchestrator pauses
   * animation progress for the specified duration at impact.
   */
  readonly hitStopMs?: number;
  /**
   * Optional impact flash on defender. When true, the defender's tile flashes
   * white and shakes briefly on impact.
   */
  readonly impactFlash?: boolean;
}
