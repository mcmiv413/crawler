import type { AnimationId } from '@dungeon/content';
import { initializeThreeAnimationModules } from './three/generated/index.js';
import { getAnimationModule, listAnimationIds } from './three/three-animation-registry.js';

interface AnimationIdCarrier {
  readonly animationId?: string;
}

initializeThreeAnimationModules();

export const BUILT_IN_THREE_EFFECT_IDS = listAnimationIds();

export function isBuiltInThreeEffectId(animationId: string | undefined): animationId is AnimationId {
  return animationId !== undefined && getAnimationModule(animationId as AnimationId) !== undefined;
}

export function collectHandledThreeAnimationIds(
  ...animationGroups: readonly ReadonlyArray<AnimationIdCarrier>[]
): AnimationId[] {
  const handledIds = new Set<AnimationId>();

  for (const group of animationGroups) {
    for (const animation of group) {
      if (!isBuiltInThreeEffectId(animation.animationId)) {
        continue;
      }

      handledIds.add(animation.animationId);
    }
  }

  return [...handledIds];
}

export function hasHandledThreeAnimation(
  ...animationGroups: readonly ReadonlyArray<AnimationIdCarrier>[]
): boolean {
  return animationGroups.some((group) =>
    group.some((animation) => isBuiltInThreeEffectId(animation.animationId)),
  );
}
