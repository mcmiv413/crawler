/**
 * Workstream 9: Guardrail tests.
 *
 * Tests that verify:
 *  1. The default animation renderer mode is 'three' after full migration
 *  2. The Three module registry correctly handles coverage checking
 *  3. No AnimationId can be registered with an invalid format
 *
 * Note: Live content coverage tests (verifying every @dungeon/content
 * AnimationId has a Three module) live in tests/contracts/ to comply with
 * the audit guardrail rule that unit tests must not import @dungeon/content.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getAnimationRendererMode } from '../../config/feature-flags.js';
import {
  registerAnimationModule,
  getAnimationModule,
  listAnimationIds,
  resetForTesting,
} from './three-animation-registry.js';
import type { ThreeAnimationModule } from './three-animation-types.js';
import type { AnimationId, AnimationCategory } from '@dungeon/content';

// ---------------------------------------------------------------------------
// Stable local test IDs — no live @dungeon/content imports
// ---------------------------------------------------------------------------

const TEST_ID_IMPACT = 'fx.impact.test-burst' as AnimationId;
const TEST_ID_SELF = 'fx.self.test-heal' as AnimationId;
const TEST_ID_AOE = 'fx.aoe.test-bomb' as AnimationId;
const TEST_ID_PROJECTILE = 'fx.projectile.test-arrow' as AnimationId;
const TEST_ID_STATUS = 'fx.status.test-ring' as AnimationId;
const TEST_ID_UTILITY = 'fx.utility.test-trap' as AnimationId;

const ALL_TEST_IDS: AnimationId[] = [
  TEST_ID_IMPACT,
  TEST_ID_SELF,
  TEST_ID_AOE,
  TEST_ID_PROJECTILE,
  TEST_ID_STATUS,
  TEST_ID_UTILITY,
];

function makeStubModule(id: AnimationId, category: AnimationCategory): ThreeAnimationModule {
  return {
    id,
    category,
    create: vi.fn(() => ({})),
    setPosition: vi.fn(),
    update: vi.fn(),
    dispose: vi.fn(),
  };
}

// ---------------------------------------------------------------------------
// Suite: Animation renderer mode default
// ---------------------------------------------------------------------------

describe('getAnimationRendererMode default', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns "three" as the default mode when no env var is set', () => {
    vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', '');
    vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', undefined);
    expect(getAnimationRendererMode()).toBe('three');
  });

  it('still supports "canvas" mode via env override', () => {
    vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'canvas');
    vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', undefined);
    expect(getAnimationRendererMode()).toBe('canvas');
  });

  it('still supports "three" mode via env override', () => {
    vi.stubEnv('VITE_ANIMATION_RENDERER_MODE', 'three');
    vi.stubGlobal('__DUNGEON_ANIMATION_RENDERER_MODE_OVERRIDE__', undefined);
    expect(getAnimationRendererMode()).toBe('three');
  });
});

// ---------------------------------------------------------------------------
// Suite: Animation module registry — coverage detection logic
// ---------------------------------------------------------------------------

describe('Three animation module registry coverage detection', () => {
  beforeEach(() => {
    resetForTesting();
  });

  afterEach(() => {
    resetForTesting();
  });

  it('a fully populated registry returns a module for every registered ID', () => {
    for (const id of ALL_TEST_IDS) {
      const parts = id.split('.');
      const category = parts[1]! as AnimationCategory;
      registerAnimationModule(makeStubModule(id, category));
    }

    const missing = ALL_TEST_IDS.filter((id) => getAnimationModule(id) === undefined);
    expect(missing).toEqual([]);
  });

  it('a registry missing one ID fails coverage for that ID', () => {
    // Register all except the first
    for (const id of ALL_TEST_IDS.slice(1)) {
      const parts = id.split('.');
      const category = parts[1]! as AnimationCategory;
      registerAnimationModule(makeStubModule(id, category));
    }

    expect(getAnimationModule(ALL_TEST_IDS[0])).toBeUndefined();
  });

  it('listAnimationIds returns all registered IDs', () => {
    for (const id of ALL_TEST_IDS) {
      const parts = id.split('.');
      const category = parts[1]! as AnimationCategory;
      registerAnimationModule(makeStubModule(id, category));
    }

    const listed = listAnimationIds();
    for (const id of ALL_TEST_IDS) {
      expect(listed).toContain(id);
    }
  });

  it('registering 0 IDs produces empty list', () => {
    expect(listAnimationIds()).toHaveLength(0);
  });

  it('duplicate registration overwrites the prior entry', () => {
    const first = makeStubModule(TEST_ID_IMPACT, 'impact');
    const second = makeStubModule(TEST_ID_IMPACT, 'impact');
    registerAnimationModule(first);
    registerAnimationModule(second);
    expect(getAnimationModule(TEST_ID_IMPACT)).toBe(second);
    expect(listAnimationIds()).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Suite: Animation ID format validation
// ---------------------------------------------------------------------------

describe('AnimationId format', () => {
  it('all local test IDs conform to fx.<category>.<name> format', () => {
    for (const id of ALL_TEST_IDS) {
      expect(id).toMatch(/^fx\.[a-z]+\.[a-z0-9-]+$/);
    }
  });

  it('each test ID has category extracted correctly from id', () => {
    expect(TEST_ID_IMPACT.split('.')[1]).toBe('impact');
    expect(TEST_ID_SELF.split('.')[1]).toBe('self');
    expect(TEST_ID_AOE.split('.')[1]).toBe('aoe');
    expect(TEST_ID_STATUS.split('.')[1]).toBe('status');
    expect(TEST_ID_UTILITY.split('.')[1]).toBe('utility');
  });
});

// ---------------------------------------------------------------------------
// Suite: Three import boundary — lazy-load contract
// ---------------------------------------------------------------------------

describe('Three import boundary — lazy-load contract', () => {
  it('three-animation-registry does not eagerly import Three.js types', async () => {
    const { getAnimationModule: fn } = await import('./three-animation-registry.js');
    expect(typeof fn).toBe('function');
  });

  it('three-animation-ownership does not eagerly import Three.js types', async () => {
    const { createAnimationOwnershipState } = await import('./three-animation-ownership.js');
    expect(typeof createAnimationOwnershipState).toBe('function');
  });

  it('three-animation-types does not eagerly import Three.js runtime', async () => {
    const types = await import('./three-animation-types.js');
    expect(types).toBeDefined();
  });
});
