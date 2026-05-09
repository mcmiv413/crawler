/**
 * Animation module registry — runtime resolution of animation IDs to their draw implementations.
 *
 * In production, modules are pre-registered by the generated index.ts.
 * In dev, missing module lookups warn once per session and fall back to a fallback module to avoid blank frames.
 */

import type { AnimationId } from '@dungeon/content/animation-refs';
import type { AnimationModule } from './types.js';

const modules = new Map<AnimationId, AnimationModule>();
const devWarningsShown = new Set<AnimationId>();

/**
 * Register an animation module at runtime.
 * Called by the generated apps/web/src/animations/generated/index.ts.
 */
export function registerModule(module: AnimationModule): void {
  modules.set(module.id, module);
}

/**
 * Resolve an animation module by ID.
 * In dev: warns once per session if not found, returns fallback to avoid blank frame.
 * In prod: returns module or undefined; caller must not display a blank frame.
 */
export function resolveModule(id: AnimationId): AnimationModule | undefined {
  const module = modules.get(id);
  if (module) {
    return module;
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV && !devWarningsShown.has(id)) {
    devWarningsShown.add(id);
    console.warn(`[animations] Missing module for animation ID: ${id}. Falling back to radial impact burst.`);
  }

  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) {
    // Return fallback module for dev; in production, caller handles missing modules
    return modules.get('fx.impact.radial-impact-burst' as AnimationId);
  }

  return undefined;
}
