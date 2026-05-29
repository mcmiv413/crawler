import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnimationOwnershipState,
  reportThreeOwnership,
  getThreeOwnedAnimationIds,
  getThreeOwnedEntityIds,
  isStatusPresentationOwnedByThree,
  areCombatIndicatorsOwnedByThree,
} from './three-animation-ownership.js';
import type { AnimationId } from '@dungeon/content';
import type { EntityId } from '@dungeon/contracts';

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
});
