import { describe, it, expect } from 'vitest';
import type { MapView } from '@dungeon/presenter';
import type { StatusPresentationView } from '@dungeon/presenter';
import type { AnimationId } from '@dungeon/content';
import type { EntityId } from '@dungeon/contracts';
import {
  computeAnimationDispatchPolicy,
  getThreeOwnedAnimationIds,
  areAllStatusPresentationsOwnedByThree,
  getThreeOwnedEntityIds,
  isAnimationOwnedByThree,
} from './animation-dispatch-policy.js';

describe('AnimationDispatchPolicy', () => {
  describe('getThreeOwnedAnimationIds', () => {
    it('extracts animation IDs from module animations', () => {
      const animations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
        { animationId: 'fx.impact.radial-impact-burst' as AnimationId },
        { animationId: 'fx.self.healing-pulse' as AnimationId },
      ];

      const ids = getThreeOwnedAnimationIds(animations);

      expect(ids).toHaveLength(2);
      expect(ids).toContain('fx.self.healing-pulse' as AnimationId);
      expect(ids).toContain('fx.impact.radial-impact-burst' as AnimationId);
    });

    it('handles empty animations list', () => {
      const ids = getThreeOwnedAnimationIds([]);

      expect(ids).toEqual([]);
    });
  });

  describe('areAllStatusPresentationsOwnedByThree', () => {
    it('returns false for empty presentations', () => {
      const result = areAllStatusPresentationsOwnedByThree([], []);

      expect(result).toBe(false);
    });

    it('returns true when all presentations have owned animation IDs', () => {
      const presentations: StatusPresentationView[] = [
        { animationId: 'fx.self.healing-pulse' as AnimationId, entityScale: undefined, ring: undefined },
        { animationId: 'fx.impact.radial-impact-burst' as AnimationId, entityScale: undefined, ring: undefined },
      ];
      const ownedIds = ['fx.self.healing-pulse', 'fx.impact.radial-impact-burst'] as AnimationId[];

      const result = areAllStatusPresentationsOwnedByThree(presentations, ownedIds);

      expect(result).toBe(true);
    });

    it('returns false when any presentation has non-owned animation ID', () => {
      const presentations: StatusPresentationView[] = [
        { animationId: 'fx.self.healing-pulse' as AnimationId, entityScale: undefined, ring: undefined },
        { animationId: 'fx.unknown.animation' as AnimationId, entityScale: undefined, ring: undefined },
      ];
      const ownedIds = ['fx.self.healing-pulse'] as AnimationId[];

      const result = areAllStatusPresentationsOwnedByThree(presentations, ownedIds);

      expect(result).toBe(false);
    });

    it('returns false when a presentation has no animation ID', () => {
      const presentations: StatusPresentationView[] = [
        { animationId: undefined, entityScale: 1.2, ring: undefined },
      ];
      const ownedIds = ['fx.self.healing-pulse'] as AnimationId[];

      const result = areAllStatusPresentationsOwnedByThree(presentations, ownedIds);

      expect(result).toBe(false);
    });
  });

  describe('getThreeOwnedEntityIds', () => {
    const createMockMap = (): MapView => ({
      cells: [],
      entities: [
        { id: 'player' as EntityId, type: 'player', x: 0, y: 0, ascii: '@', color: '#fff', spriteName: undefined, instanceColor: undefined, name: 'Player', templateId: null },
        { id: 'enemy-1' as EntityId, type: 'enemy', x: 1, y: 1, ascii: 'O', color: '#f00', spriteName: undefined, instanceColor: undefined, name: 'Enemy 1', templateId: 'goblin' },
        { id: 'enemy-2' as EntityId, type: 'enemy', x: 2, y: 2, ascii: 'O', color: '#f00', spriteName: undefined, instanceColor: undefined, name: 'Enemy 2', templateId: 'goblin' },
      ],
      width: 10,
      height: 10,
      playerPosition: { x: 0, y: 0 },
      biomeId: 'dungeon',
      dangerLevel: 'safe',
    });

    it('includes entities with active move animations', () => {
      const map = createMockMap();
      const moveAnimations = [
        { entityId: 'enemy-1', progress: 0.5 },
      ] as any[];

      const ids = getThreeOwnedEntityIds(map, moveAnimations, [], false);

      expect(ids).toContain('enemy-1' as EntityId);
    });

    it('includes entities with active bump animations', () => {
      const map = createMockMap();
      const bumpAnimations = [
        { attackerId: 'enemy-2', defenderId: 'player', progress: 0.3 },
      ] as any[];

      const ids = getThreeOwnedEntityIds(map, [], bumpAnimations, false);

      expect(ids).toContain('enemy-2' as EntityId);
    });

    it('includes player when status presentation is owned', () => {
      const map = createMockMap();

      const ids = getThreeOwnedEntityIds(map, [], [], true);

      expect(ids).toContain('player' as EntityId);
    });

    it('does not include player when status presentation is not owned', () => {
      const map = createMockMap();

      const ids = getThreeOwnedEntityIds(map, [], [], false);

      expect(ids).not.toContain('player' as EntityId);
    });

    it('returns empty array for null map', () => {
      const ids = getThreeOwnedEntityIds(null, [], [], false);

      expect(ids).toEqual([]);
    });
  });

  describe('isAnimationOwnedByThree', () => {
    const policy = {
      threeOwnedAnimationIds: ['fx.self.healing-pulse', 'fx.impact.radial-impact-burst'] as AnimationId[],
      threeOwnedEntityIds: [] as EntityId[],
      threeOwnsStatusPresentations: false,
      threeOwnsCombatIndicators: false,
    };

    it('returns true for owned animation ID', () => {
      const result = isAnimationOwnedByThree('fx.self.healing-pulse' as AnimationId, policy);

      expect(result).toBe(true);
    });

    it('returns false for non-owned animation ID', () => {
      const result = isAnimationOwnedByThree('fx.unknown.animation' as AnimationId, policy);

      expect(result).toBe(false);
    });

    it('returns false for undefined animation ID', () => {
      const result = isAnimationOwnedByThree(undefined, policy);

      expect(result).toBe(false);
    });
  });

  describe('computeAnimationDispatchPolicy', () => {
    const createMockMap = (): MapView => ({
      cells: [],
      entities: [
        { id: 'player' as EntityId, type: 'player', x: 0, y: 0, ascii: '@', color: '#fff', spriteName: undefined, instanceColor: undefined, name: 'Player', templateId: null },
        { id: 'enemy-1' as EntityId, type: 'enemy', x: 1, y: 1, ascii: 'O', color: '#f00', spriteName: undefined, instanceColor: undefined, name: 'Enemy', templateId: 'goblin' },
      ],
      width: 10,
      height: 10,
      playerPosition: { x: 0, y: 0 },
      biomeId: 'dungeon',
      dangerLevel: 'safe',
    });

    it('computes policy with module animations', () => {
      const moduleAnimations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        moduleAnimations,
        [],
        [],
        [],
      );

      expect(policy.threeOwnedAnimationIds).toContain('fx.self.healing-pulse' as AnimationId);
    });

    it('marks status presentations as owned when all match owned animation IDs', () => {
      const moduleAnimations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
      ];
      const presentations: StatusPresentationView[] = [
        { animationId: 'fx.self.healing-pulse' as AnimationId, entityScale: undefined, ring: undefined },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        moduleAnimations,
        presentations,
        [],
        [],
      );

      expect(policy.threeOwnsStatusPresentations).toBe(true);
    });

    it('does not mark status presentations as owned when any do not match', () => {
      const moduleAnimations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
      ];
      const presentations: StatusPresentationView[] = [
        { animationId: 'fx.unknown.animation' as AnimationId, entityScale: undefined, ring: undefined },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        moduleAnimations,
        presentations,
        [],
        [],
      );

      expect(policy.threeOwnsStatusPresentations).toBe(false);
    });

    it('includes entities with move animations', () => {
      const moveAnimations = [
        { entityId: 'enemy-1', progress: 0.5 },
      ] as any[];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [],
        [],
        moveAnimations,
        [],
      );

      expect(policy.threeOwnedEntityIds).toContain('enemy-1' as EntityId);
    });

    it('includes player when status presentations are owned', () => {
      const moduleAnimations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
      ];
      const presentations: StatusPresentationView[] = [
        { animationId: 'fx.self.healing-pulse' as AnimationId, entityScale: undefined, ring: undefined },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        moduleAnimations,
        presentations,
        [],
        [],
      );

      expect(policy.threeOwnedEntityIds).toContain('player' as EntityId);
    });
  });
});
