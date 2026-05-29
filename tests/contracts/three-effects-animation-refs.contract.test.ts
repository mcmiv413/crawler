import { describe, it, expect } from 'vitest';
import { ANIMATION_REF_BY_ID } from '@dungeon/content';
import { BUILT_IN_THREE_EFFECT_IDS } from '../../apps/web/src/rendering/three/effects/index.js';

/**
 * Contract Test: Three.js Effect Animation Refs
 *
 * Validates that every animation ID registered by the Three.js effect modules
 * actually exists in the live @dungeon/content animation catalog.
 *
 * This is a LIVE CONTENT test — importing @dungeon/content here is intentional.
 * Unit tests for Three effects use local fixture IDs; this contract test checks
 * that the IDs wired into the renderer match reality.
 *
 * MVP: only `fx.self.healing-pulse` is registered.
 * When new Three effects are added, BUILT_IN_THREE_EFFECT_IDS grows automatically
 * and new IDs must pass this contract or the build fails.
 */
describe('Three effects animation refs contract', () => {
  it('BUILT_IN_THREE_EFFECT_IDS is a non-empty list', () => {
    expect(Array.isArray(BUILT_IN_THREE_EFFECT_IDS)).toBe(true);
    expect(BUILT_IN_THREE_EFFECT_IDS.length).toBeGreaterThan(0);
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

  it('includes the MVP healing-pulse effect', () => {
    expect(BUILT_IN_THREE_EFFECT_IDS).toContain('fx.self.healing-pulse');
  });
});
