/**
 * Test layer: unit
 * Behavior: The registry stores Three animation modules by ID, overwrites duplicate IDs, lists registered IDs, resets test state, and initializes generated built-in modules.
 * Proof: Assertions check getAnimationModule returns exact registered references or undefined, listAnimationIds has expected IDs/counts without duplicates, resetForTesting clears entries, lightning built-ins are registered, and module lifecycle functions are called once.
 * Validation: pnpm vitest run apps/web/src/rendering/three/three-animation-registry.test.ts
 */
/**
 * Tests for three-animation-registry.ts
 *
 * The generalized animation registry maps AnimationId → ThreeAnimationModule.
 * It extends the effect registry pattern with a typed `id` and `category` on
 * every module so the overlay can enumerate owned animation IDs without a
 * separate metadata structure.
 *
 * Key differences from three-effect-registry:
 *  - Modules carry `id` (AnimationId) and `category` (AnimationCategory)
 *  - `listIds()` returns every currently-registered AnimationId
 *  - `resetForTesting()` is the test-only reset API (not exported as `clear`)
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  registerAnimationModule,
  getAnimationModule,
  listAnimationIds,
  resetForTesting,
} from './three-animation-registry.js';
import { initializeThreeAnimationModules } from './generated/index.js';
import { lightningStrike } from './modules/impact/lightning-strike.js';
import { lightningBolt } from './modules/projectile/lightning-bolt.js';
import type { ThreeAnimationModule } from './three-animation-types.js';

type AnimationCategory = ThreeAnimationModule['category'];

// ---------------------------------------------------------------------------
// Fixture factories — no live @dungeon/content imports
// ---------------------------------------------------------------------------

interface FakeInstance {
  readonly tag: string;
  disposed: boolean;
}

function makeFakeInstance(tag = 'inst'): FakeInstance {
  return { tag, disposed: false };
}

function makeModule(
  id: string,
  category: AnimationCategory = 'impact',
): ThreeAnimationModule<FakeInstance> {
  return {
    id: id as any,
    category,
    create: vi.fn(() => makeFakeInstance(id)),
    setPosition: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  };
}

// Stable test IDs — never imported from content packages
const ID_IMPACT = 'fx.impact.test-radial-burst' as const;
const ID_SELF = 'fx.self.test-healing-pulse' as const;
const ID_PROJECTILE = 'fx.projectile.test-arrow' as const;

// ---------------------------------------------------------------------------
// Suite: registerAnimationModule
// ---------------------------------------------------------------------------

describe('registerAnimationModule', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('stores a module retrievable by its id', () => {
    const mod = makeModule(ID_IMPACT);
    registerAnimationModule(mod);
    expect(getAnimationModule(ID_IMPACT as any)).toBe(mod);
  });

  it('stores multiple modules independently', () => {
    const modA = makeModule(ID_IMPACT);
    const modB = makeModule(ID_SELF, 'self');
    registerAnimationModule(modA);
    registerAnimationModule(modB);

    expect(getAnimationModule(ID_IMPACT as any)).toBe(modA);
    expect(getAnimationModule(ID_SELF as any)).toBe(modB);
  });

  it('last-write-wins on duplicate id', () => {
    const first = makeModule(ID_IMPACT);
    const second = makeModule(ID_IMPACT);
    registerAnimationModule(first);
    registerAnimationModule(second);

    expect(getAnimationModule(ID_IMPACT as any)).toBe(second);
    expect(getAnimationModule(ID_IMPACT as any)).not.toBe(first);
  });

  it('does not cross-contaminate other ids after overwrite', () => {
    const orig = makeModule(ID_IMPACT);
    const replacement = makeModule(ID_IMPACT);
    const unrelated = makeModule(ID_SELF, 'self');
    registerAnimationModule(orig);
    registerAnimationModule(unrelated);
    registerAnimationModule(replacement);

    expect(getAnimationModule(ID_IMPACT as any)).toBe(replacement);
    expect(getAnimationModule(ID_SELF as any)).toBe(unrelated);
  });

  it('registers 100 modules without collision', () => {
    const mods: ThreeAnimationModule<FakeInstance>[] = [];
    for (let i = 0; i < 100; i++) {
      const id = `fx.impact.bulk-${i}` as any;
      const mod = makeModule(id, 'impact');
      registerAnimationModule(mod);
      mods.push(mod);
    }
    for (const mod of mods) {
      expect(getAnimationModule(mod.id)).toBe(mod);
    }
  });
});

// ---------------------------------------------------------------------------
// Suite: getAnimationModule
// ---------------------------------------------------------------------------

describe('getAnimationModule', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('returns undefined for an unregistered id', () => {
    expect(getAnimationModule(ID_IMPACT as any)).toBeUndefined();
  });

  it('returns the exact module reference registered', () => {
    const mod = makeModule(ID_IMPACT);
    registerAnimationModule(mod);
    expect(getAnimationModule(ID_IMPACT as any)).toBe(mod);
  });

  it('returns undefined after resetForTesting()', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    resetForTesting();
    expect(getAnimationModule(ID_IMPACT as any)).toBeUndefined();
  });

  it('is case-sensitive', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    expect(getAnimationModule(ID_IMPACT.toUpperCase() as any)).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Suite: listAnimationIds
// ---------------------------------------------------------------------------

describe('listAnimationIds', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('returns empty array when nothing is registered', () => {
    expect(listAnimationIds()).toEqual([]);
  });

  it('returns the id of a single registered module', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    expect(listAnimationIds()).toContain(ID_IMPACT);
  });

  it('returns all registered ids', () => {
    registerAnimationModule(makeModule(ID_IMPACT, 'impact'));
    registerAnimationModule(makeModule(ID_SELF, 'self'));
    registerAnimationModule(makeModule(ID_PROJECTILE, 'projectile'));

    const ids = listAnimationIds();
    expect(ids).toHaveLength(3);
    expect(ids).toContain(ID_IMPACT);
    expect(ids).toContain(ID_SELF);
    expect(ids).toContain(ID_PROJECTILE);
  });

  it('reflects the latest id after an overwrite (no duplicates)', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    registerAnimationModule(makeModule(ID_IMPACT)); // overwrite
    const ids = listAnimationIds();
    expect(ids.filter(id => id === ID_IMPACT)).toHaveLength(1);
  });

  it('returns empty after resetForTesting()', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    resetForTesting();
    expect(listAnimationIds()).toEqual([]);
  });
});

describe('generated registry integration', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('registers the built-in lightning strike and lightning bolt modules', () => {
    initializeThreeAnimationModules();

    expect(getAnimationModule(lightningStrike.id)).toBe(lightningStrike);
    expect(getAnimationModule(lightningBolt.id)).toBe(lightningBolt);
    expect(listAnimationIds()).toEqual(expect.arrayContaining([
      lightningStrike.id,
      lightningBolt.id,
    ]));
  });
});

// ---------------------------------------------------------------------------
// Suite: module shape contract
// ---------------------------------------------------------------------------

describe('ThreeAnimationModule shape', () => {
  beforeEach(() => {
    resetForTesting();
  });

  it('module carries id matching the registry key', () => {
    const mod = makeModule(ID_IMPACT);
    registerAnimationModule(mod);
    const retrieved = getAnimationModule(ID_IMPACT as any)!;
    expect(retrieved.id).toBe(ID_IMPACT);
  });

  it('module carries category', () => {
    const mod = makeModule(ID_SELF, 'self');
    registerAnimationModule(mod);
    const retrieved = getAnimationModule(ID_SELF as any)!;
    expect(retrieved.category).toBe('self');
  });

  it('create, setPosition, update, dispose are callable', () => {
    const mod = makeModule(ID_IMPACT, 'impact');
    registerAnimationModule(mod);
    const retrieved = getAnimationModule(ID_IMPACT as any)!;
    const ctx = {
      renderer: {},
      scene: { add: vi.fn(), remove: vi.fn() },
      camera: {},
      canvasWidth: 720,
      canvasHeight: 528,
      vpLeft: 0,
      vpTop: 0,
      tileSize: 24,
    };
    const inst = retrieved.create(ctx);
    expect(inst).toBeDefined();
    retrieved.setPosition(inst, { x: 10, y: 20, z: 0 });
    retrieved.update(inst, 0.5);
    retrieved.dispose(inst);

    expect(mod.create).toHaveBeenCalledTimes(1);
    expect(mod.setPosition).toHaveBeenCalledTimes(1);
    expect(mod.update).toHaveBeenCalledTimes(1);
    expect(mod.dispose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Suite: resetForTesting is test-only
// ---------------------------------------------------------------------------

describe('resetForTesting', () => {
  it('clears all modules', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    registerAnimationModule(makeModule(ID_SELF, 'self'));
    resetForTesting();

    expect(getAnimationModule(ID_IMPACT as any)).toBeUndefined();
    expect(getAnimationModule(ID_SELF as any)).toBeUndefined();
    expect(listAnimationIds()).toEqual([]);
  });

  it('allows fresh registration after reset', () => {
    registerAnimationModule(makeModule(ID_IMPACT));
    resetForTesting();

    const fresh = makeModule(ID_IMPACT);
    registerAnimationModule(fresh);
    expect(getAnimationModule(ID_IMPACT as any)).toBe(fresh);
  });
});
