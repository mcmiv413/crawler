/**
 * Registry mapping AnimationId strings to ThreeEffectModule implementations.
 *
 * Duplicate-registration policy: last write wins (overwrites silently).
 */

export interface ThreeEffectModule {
  create(context: unknown): unknown;
  update(effect: unknown, progress: number): void;
  dispose(effect: unknown): void;
}

const modules = new Map<string, ThreeEffectModule>();

export function register(animationId: string, module: ThreeEffectModule): void {
  modules.set(animationId, module);
}

export function get(animationId: string): ThreeEffectModule | undefined {
  return modules.get(animationId);
}

export function clear(): void {
  modules.clear();
}
