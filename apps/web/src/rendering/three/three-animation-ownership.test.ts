/**
 * Test layer: unit
 * Behavior: The ownership state reports and queries which animations, entities, status presentation, and combat indicators are currently owned by Three.
 * Proof: Assertions check empty initial arrays and flags, updated and replaced animation/entity ownership, status and combat ownership booleans, unchanged prior state after reporting, and true/false animation ID membership results.
 * Validation: pnpm vitest run apps/web/src/rendering/three/three-animation-ownership.test.ts
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnimationOwnershipState,
  reportThreeOwnership,
  getThreeOwnedAnimationIds,
  getThreeOwnedEntityIds,
  isStatusPresentationOwnedByThree,
  areCombatIndicatorsOwnedByThree,
  isAnimationOwnedByThree,
} from './three-animation-ownership.js';
import type { EntityId } from '@dungeon/contracts';

type AnimationId = `fx.${'status' | 'impact' | 'projectile' | 'self' | 'aoe' | 'utility'}.${string}`;

describe('AnimationOwnershipState', () => {
  describe('createAnimationOwnershipState', () => {
    it('creates initial state with no Three ownership', () => {
      const state = createAnimationOwnershipState();

      expect(getThreeOwnedAnimationIds(state)).toEqual([]);
      expect(getThreeOwnedEntityIds(state)).toEqual([]);
      expect(isStatusPresentationOwnedByThree(state)).toBe(false);
      expect(areCombatIndicatorsOwnedByThree(state)).toBe(false);
    });
  });

  describe('reportThreeOwnership', () => {
    let state: ReturnType<typeof createAnimationOwnershipState>;

    beforeEach(() => {
      state = createAnimationOwnershipState();
    });

    it('updates owned animation IDs', () => {
      const animationIds: AnimationId[] = ['fx.self.healing-pulse', 'fx.impact.radial-impact-burst'];
      const newState = reportThreeOwnership(state, {
        animationIds,
        entityIds: [],
        statusPresentation: false,
        combatIndicators: false,
      });

      expect(getThreeOwnedAnimationIds(newState)).toEqual(animationIds);
    });

    it('updates owned entity IDs', () => {
      const entityIds = ['player', 'enemy-1'] as EntityId[];
      const newState = reportThreeOwnership(state, {
        animationIds: [],
        entityIds,
        statusPresentation: false,
        combatIndicators: false,
      });

      expect(getThreeOwnedEntityIds(newState)).toEqual(entityIds);
    });

    it('updates status presentation ownership', () => {
      const newState = reportThreeOwnership(state, {
        animationIds: [],
        entityIds: [],
        statusPresentation: true,
        combatIndicators: false,
      });

      expect(isStatusPresentationOwnedByThree(newState)).toBe(true);
    });

    it('updates combat indicators ownership', () => {
      const newState = reportThreeOwnership(state, {
        animationIds: [],
        entityIds: [],
        statusPresentation: false,
        combatIndicators: true,
      });

      expect(areCombatIndicatorsOwnedByThree(newState)).toBe(true);
    });

    it('returns immutable state', () => {
      const newState = reportThreeOwnership(state, {
        animationIds: ['fx.self.healing-pulse'],
        entityIds: [],
        statusPresentation: false,
        combatIndicators: false,
      });

      expect(getThreeOwnedAnimationIds(state)).toEqual([]);
      expect(getThreeOwnedAnimationIds(newState)).toEqual(['fx.self.healing-pulse']);
    });

    it('supports partial updates', () => {
      let state = createAnimationOwnershipState();
      state = reportThreeOwnership(state, {
        animationIds: ['fx.self.healing-pulse'],
        entityIds: [] as EntityId[],
        statusPresentation: false,
        combatIndicators: false,
      });
      state = reportThreeOwnership(state, {
        animationIds: ['fx.self.healing-pulse'],
        entityIds: ['player'] as EntityId[],
        statusPresentation: true,
        combatIndicators: false,
      });

      expect(getThreeOwnedAnimationIds(state)).toEqual(['fx.self.healing-pulse']);
      expect(getThreeOwnedEntityIds(state)).toEqual(['player']);
      expect(isStatusPresentationOwnedByThree(state)).toBe(true);
      expect(areCombatIndicatorsOwnedByThree(state)).toBe(false);
    });

    it('replaces animation IDs on subsequent calls', () => {
      let state = createAnimationOwnershipState();
      state = reportThreeOwnership(state, {
        animationIds: ['fx.self.healing-pulse'],
        entityIds: [],
        statusPresentation: false,
        combatIndicators: false,
      });
      state = reportThreeOwnership(state, {
        animationIds: ['fx.impact.radial-impact-burst'],
        entityIds: [],
        statusPresentation: false,
        combatIndicators: false,
      });

      expect(getThreeOwnedAnimationIds(state)).toEqual(['fx.impact.radial-impact-burst']);
    });
  });

  describe('isAnimationOwnedByThree', () => {
    it('returns false for undefined animation ID', () => {
      const result = isAnimationOwnedByThree(undefined, ['fx.self.healing-pulse']);
      expect(result).toBe(false);
    });

    it('returns true when animation ID is in owned IDs', () => {
      const ownedIds: AnimationId[] = ['fx.self.healing-pulse', 'fx.impact.radial-impact-burst'];
      const result = isAnimationOwnedByThree('fx.self.healing-pulse', ownedIds);
      expect(result).toBe(true);
    });

    it('returns false when animation ID is not in owned IDs', () => {
      const ownedIds: AnimationId[] = ['fx.self.healing-pulse'];
      const result = isAnimationOwnedByThree('fx.impact.radial-impact-burst', ownedIds);
      expect(result).toBe(false);
    });

    it('returns false for empty owned IDs', () => {
      const result = isAnimationOwnedByThree('fx.self.healing-pulse', []);
      expect(result).toBe(false);
    });
  });

});
