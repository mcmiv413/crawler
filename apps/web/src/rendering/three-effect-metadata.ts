import { animationRefs, type AnimationId } from '@dungeon/content';

interface AnimationIdCarrier {
  readonly animationId?: string;
}

export const BUILT_IN_THREE_EFFECT_IDS = [
  animationRefs.self.healingPulse.id,
] as const satisfies readonly AnimationId[];

const BUILT_IN_THREE_EFFECT_ID_SET = new Set<AnimationId>(BUILT_IN_THREE_EFFECT_IDS);

export function isBuiltInThreeEffectId(animationId: string | undefined): animationId is AnimationId {
  return animationId !== undefined && BUILT_IN_THREE_EFFECT_ID_SET.has(animationId as AnimationId);
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
