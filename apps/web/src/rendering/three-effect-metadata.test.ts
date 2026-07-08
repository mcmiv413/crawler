/**
 * Test layer: unit
 * Behavior: Three Effect Metadata covers three-effect-metadata; isBuiltInThreeEffectId; returns false when no modules are registered.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/three-effect-metadata.test.ts
 */
/**
 * Tests for three-effect-metadata.ts
 *
 * Contracts:
 *  - isBuiltInThreeEffectId returns false before any modules are registered
 *  - isBuiltInThreeEffectId returns true for registered animation IDs
 *  - collectHandledThreeAnimationIds collects registered IDs from animation groups
 *  - hasHandledThreeAnimation returns true when a group contains a registered ID
 *  - Both functions return empty/false for unregistered IDs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { registerAnimationModule, resetForTesting } from './three/three-animation-registry.js';
import {
  isBuiltInThreeEffectId,
  collectHandledThreeAnimationIds,
  hasHandledThreeAnimation,
} from './three-effect-metadata.js';
import type { ThreeAnimationModule } from './three/three-animation-types.js';

// ---------------------------------------------------------------------------
// Minimal stub module factory
// ---------------------------------------------------------------------------

function makeStubModule(id: string, category: string): ThreeAnimationModule {
  return {
    id: id as any,
    category: category as any,
    create: () => ({}),
    setPosition: () => undefined,
    update: () => undefined,
    dispose: () => undefined,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('three-effect-metadata', () => {
  beforeEach(() => {
    resetForTesting();
  });

  afterEach(() => {
    resetForTesting();
  });

  describe('isBuiltInThreeEffectId', () => {
    it('returns false when no modules are registered', () => {
      expect(isBuiltInThreeEffectId('fx.self.healing-pulse')).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isBuiltInThreeEffectId(undefined)).toBe(false);
    });

    it('returns true after a module with that id is registered', () => {
      registerAnimationModule(makeStubModule('fx.impact.radial-impact-burst', 'impact'));
      expect(isBuiltInThreeEffectId('fx.impact.radial-impact-burst')).toBe(true);
    });

    it('returns false for an unregistered id when other modules exist', () => {
      registerAnimationModule(makeStubModule('fx.impact.radial-impact-burst', 'impact'));
      expect(isBuiltInThreeEffectId('fx.self.healing-pulse')).toBe(false);
    });

    it('returns true for multiple registered ids', () => {
      registerAnimationModule(makeStubModule('fx.impact.forward-slash', 'impact'));
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      expect(isBuiltInThreeEffectId('fx.impact.forward-slash')).toBe(true);
      expect(isBuiltInThreeEffectId('fx.self.healing-pulse')).toBe(true);
    });
  });

  describe('collectHandledThreeAnimationIds', () => {
    it('returns empty array when no animations match', () => {
      const result = collectHandledThreeAnimationIds([{ animationId: 'fx.self.healing-pulse' }]);
      expect(result).toEqual([]);
    });

    it('returns the id when a matching animation is registered', () => {
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      const result = collectHandledThreeAnimationIds([{ animationId: 'fx.self.healing-pulse' }]);
      expect(result).toContain('fx.self.healing-pulse');
    });

    it('deduplicates ids across multiple animations', () => {
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      const result = collectHandledThreeAnimationIds([
        { animationId: 'fx.self.healing-pulse' },
        { animationId: 'fx.self.healing-pulse' },
      ]);
      expect(result).toHaveLength(1);
    });

    it('collects ids from multiple groups', () => {
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      registerAnimationModule(makeStubModule('fx.impact.forward-slash', 'impact'));
      const result = collectHandledThreeAnimationIds(
        [{ animationId: 'fx.self.healing-pulse' }],
        [{ animationId: 'fx.impact.forward-slash' }],
      );
      expect(result).toContain('fx.self.healing-pulse');
      expect(result).toContain('fx.impact.forward-slash');
    });

    it('ignores animations with undefined animationId', () => {
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      const result = collectHandledThreeAnimationIds([{ animationId: undefined }]);
      expect(result).toHaveLength(0);
    });

    it('ignores unregistered animation ids', () => {
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      const result = collectHandledThreeAnimationIds([{ animationId: 'fx.unknown.thing' }]);
      expect(result).toHaveLength(0);
    });
  });

  describe('hasHandledThreeAnimation', () => {
    it('returns false when no animations match', () => {
      const result = hasHandledThreeAnimation([{ animationId: 'fx.self.healing-pulse' }]);
      expect(result).toBe(false);
    });

    it('returns true when a matching animation is registered', () => {
      registerAnimationModule(makeStubModule('fx.self.healing-pulse', 'self'));
      const result = hasHandledThreeAnimation([{ animationId: 'fx.self.healing-pulse' }]);
      expect(result).toBe(true);
    });

    it('returns true when any group has a matching animation', () => {
      registerAnimationModule(makeStubModule('fx.impact.forward-slash', 'impact'));
      const result = hasHandledThreeAnimation(
        [{ animationId: 'fx.self.healing-pulse' }],
        [{ animationId: 'fx.impact.forward-slash' }],
      );
      expect(result).toBe(true);
    });

    it('returns false when groups are empty', () => {
      expect(hasHandledThreeAnimation([], [])).toBe(false);
    });
  });
});
