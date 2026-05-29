/**
 * Contract test: Three.js animation module coverage.
 *
 * Verifies that every AnimationId declared in @dungeon/content has a
 * corresponding Three.js module registered by initializeThreeAnimationModules().
 *
 * This test lives in tests/contracts/ because it must import live content
 * (@dungeon/content animationRefs) — a guardrail violation in unit tests.
 *
 * Exit criteria: no AnimationId is missing a Three module.
 * Adding a new AnimationRef to content without a Three module will fail this test.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { animationRefs, type AnimationId } from '@dungeon/content';
import {
  getAnimationModule,
  listAnimationIds,
  resetForTesting,
} from '../../apps/web/src/rendering/three/three-animation-registry.js';
import { initializeThreeAnimationModules } from '../../apps/web/src/rendering/three/generated/index.js';

// ---------------------------------------------------------------------------
// Collect all known AnimationIds from content catalog
// ---------------------------------------------------------------------------

function getAllContentAnimationIds(): AnimationId[] {
  const ids: AnimationId[] = [];
  for (const category of Object.values(animationRefs)) {
    for (const ref of Object.values(category)) {
      ids.push((ref as { id: AnimationId }).id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Suite: Three module coverage contract
// ---------------------------------------------------------------------------

describe('Three animation module coverage contract', () => {
  beforeEach(() => {
    resetForTesting();
    initializeThreeAnimationModules();
  });

  afterEach(() => {
    resetForTesting();
  });

  it('content catalog has at least 20 animation IDs', () => {
    const ids = getAllContentAnimationIds();
    expect(ids.length).toBeGreaterThanOrEqual(20);
  });

  it('every content AnimationId has a registered Three module', () => {
    const contentIds = getAllContentAnimationIds();
    const missingIds = contentIds.filter((id) => getAnimationModule(id) === undefined);

    if (missingIds.length > 0) {
      throw new Error(
        `Missing Three modules for ${missingIds.length} AnimationId(s):\n` +
          missingIds.map((id) => `  - ${id}`).join('\n') +
          '\n\nAdd a Three module in apps/web/src/rendering/three/modules/<category>/ ' +
          'and register it in apps/web/src/rendering/three/generated/index.ts',
      );
    }

    expect(missingIds).toEqual([]);
  });

  it('no unrecognized IDs are registered without a content ref', () => {
    const contentIds = new Set(getAllContentAnimationIds());
    const registeredIds = listAnimationIds();
    const unknownIds = registeredIds.filter((id) => !contentIds.has(id));

    expect(unknownIds).toEqual([]);
  });

  it('all registered module IDs match the fx.<category>.<name> format', () => {
    const registeredIds = listAnimationIds();
    for (const id of registeredIds) {
      expect(id).toMatch(/^fx\.[a-z]+\.[a-z0-9-]+$/);
    }
  });

  it('registered module category matches the ID prefix', () => {
    const contentIds = getAllContentAnimationIds();
    for (const id of contentIds) {
      const module = getAnimationModule(id);
      if (module === undefined) continue; // already caught above
      const categoryFromId = id.split('.')[1];
      expect(module.category).toBe(categoryFromId);
    }
  });
});
