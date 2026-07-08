/**
 * Test layer: contract
 * Behavior: Three Effects covers Three effect contracts; derives metadata ids from the generated Three registry; registers every built-in metadata id into the Three anima....
 * Proof: live catalog/schema assertions validate IDs, shapes, and cross references.
 * Validation: pnpm vitest run apps/web/src/rendering/three/three-effects.contract.test.ts
 */
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
        ANIMATION_REF_BY_ID.has(id),
        `Three effect "${id}" is not registered in ANIMATION_REF_BY_ID — ` +
          `add it to packages/content/src/animation-refs/ and regenerate indexes`,
      ).toBe(true);
    },
  );

  it('registers every built-in metadata id into the Three animation registry', () => {
    initializeThreeAnimationModules();

    for (const animationId of BUILT_IN_THREE_EFFECT_IDS) {
      expect(getAnimationModule(animationId)).toEqual(expect.objectContaining({ id: animationId }));
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
