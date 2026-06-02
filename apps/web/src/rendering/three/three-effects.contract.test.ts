import { beforeEach, describe, expect, it } from 'vitest';
import { ANIMATION_REF_BY_ID, animationRefs } from '@dungeon/content';
import { BUILT_IN_THREE_EFFECT_IDS } from '../three-effect-metadata.js';
import { initializeThreeAnimationModules } from './generated/index.js';
import { getAnimationModule, listAnimationIds, resetForTesting } from './three-animation-registry.js';
import { lightningStrike } from './modules/impact/lightning-strike.js';
import { lightningBolt } from './modules/projectile/lightning-bolt.js';

describe('Three effect contracts', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('derives metadata ids from the generated Three registry', () => {
    initializeThreeAnimationModules();
    expect(listAnimationIds()).toEqual(BUILT_IN_THREE_EFFECT_IDS);
  });

  it.each(BUILT_IN_THREE_EFFECT_IDS)(
    'AnimationId %s exists in ANIMATION_REF_BY_ID',
    (id) => {
      expect(
        ANIMATION_REF_BY_ID.get(id),
        `Three effect "${id}" is not registered in ANIMATION_REF_BY_ID — ` +
          `add it to packages/content/src/animation-refs/ and regenerate indexes`,
      ).toBeDefined();
    },
  );

  it('registers every built-in metadata id into the Three animation registry', () => {
    initializeThreeAnimationModules();

    for (const animationId of BUILT_IN_THREE_EFFECT_IDS) {
      expect(getAnimationModule(animationId)).toBeDefined();
    }
  });

  it('registers the Lightning ring strike and projectile modules into the Three registry', () => {
    initializeThreeAnimationModules();

    expect(getAnimationModule(animationRefs.impact.lightningStrike.id)).toBe(lightningStrike);
    expect(getAnimationModule(animationRefs.projectile.lightningBolt.id)).toBe(lightningBolt);
  });

  it('includes the MVP healing-pulse effect', () => {
    expect(BUILT_IN_THREE_EFFECT_IDS).toContain('fx.self.healing-pulse');
  });
});
