import { beforeEach, describe, expect, it } from 'vitest';
import { ANIMATION_REF_BY_ID } from '@dungeon/content';
import { BUILT_IN_THREE_EFFECT_IDS } from '../three-effect-metadata.js';
import {
  BUILT_IN_THREE_EFFECT_REGISTRATIONS,
  registerBuiltInThreeEffects,
} from './effects/index.js';
import { clear, get } from './three-effect-registry.js';

describe('Three effect contracts', () => {
  beforeEach(() => {
    clear();
  });

  it('keeps metadata and built-in registrations in parity', () => {
    const registrationIds = BUILT_IN_THREE_EFFECT_REGISTRATIONS.map(({ animationId }) => animationId);

    expect(registrationIds).toEqual(BUILT_IN_THREE_EFFECT_IDS);
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

  it('registers every built-in metadata ID into the Three effect registry', () => {
    registerBuiltInThreeEffects();

    for (const animationId of BUILT_IN_THREE_EFFECT_IDS) {
      expect(get(animationId)).toBeDefined();
    }
  });

  it('includes the MVP healing-pulse effect', () => {
    expect(BUILT_IN_THREE_EFFECT_IDS).toContain('fx.self.healing-pulse');
  });
});
