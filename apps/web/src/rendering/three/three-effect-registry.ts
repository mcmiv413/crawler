import type { AnimationId } from '@dungeon/content';
import type { ThreeEffectModule } from './three-effect-types.js';

/**
 * Registry mapping AnimationId to ThreeEffectModule implementations.
 *
 * Duplicate-registration policy: last write wins (overwrites silently).
 */

const modules = new Map<AnimationId, ThreeEffectModule>();

export function register(animationId: AnimationId, module: ThreeEffectModule): void {
  modules.set(animationId, module);
}

export function get(animationId: AnimationId): ThreeEffectModule | undefined {
  return modules.get(animationId);
}

export function clear(): void {
  modules.clear();
}
