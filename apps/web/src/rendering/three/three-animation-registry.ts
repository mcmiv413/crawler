/**
 * Generalized Three.js animation module registry.
 *
 * Maps AnimationId → ThreeAnimationModule. Supports any AnimationId from
 * @dungeon/content, unlike the narrower three-effect-registry which was
 * scoped to the MVP single-effect overlay.
 *
 * Duplicate-registration policy: last write wins (overwrites silently).
 * This matches the canvas animation registry and allows hot-reload / generated
 * index re-registration without error.
 *
 * Test isolation: use resetForTesting() in beforeEach. This function is
 * intentionally NOT named `clear` to make test-only usage visually obvious.
 * Production code must never call resetForTesting().
 */

import type { AnimationId } from '@dungeon/content';
import type { ThreeAnimationModule } from './three-animation-types.js';

const modules = new Map<AnimationId, ThreeAnimationModule>();

/**
 * Register an animation module. The module's `id` field is used as the key.
 * Duplicate registrations silently replace the previous entry (last-write-wins).
 */
export function registerAnimationModule(module: ThreeAnimationModule): void {
  modules.set(module.id, module);
}

/**
 * Look up a registered animation module by AnimationId.
 * Returns undefined if no module is registered for the given id.
 */
export function getAnimationModule(animationId: AnimationId): ThreeAnimationModule | undefined {
  return modules.get(animationId);
}

/**
 * Returns all currently registered AnimationIds.
 * Used by the overlay to enumerate owned IDs and by contract tests.
 */
export function listAnimationIds(): readonly AnimationId[] {
  return [...modules.keys()];
}

/**
 * Clear all registered modules.
 *
 * FOR TESTS ONLY — do not call from production render paths.
 * Use in beforeEach() to isolate registry state between test suites.
 */
export function resetForTesting(): void {
  modules.clear();
}
