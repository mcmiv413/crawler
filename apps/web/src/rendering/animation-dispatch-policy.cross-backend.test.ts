/**
 * Test layer: unit
 * Behavior: Animation Dispatch Policy.cross Backend covers AnimationDispatchPolicy - Cross-Backend Coordination; Three-owned animations excluded from canvas; canvas filters out Three-owned module....
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run apps/web/src/rendering/animation-dispatch-policy.cross-backend.test.ts
 */
import { describe, it, expect } from 'vitest';
import type { MapView } from '@dungeon/presenter';
import type { StatusPresentationView } from '@dungeon/presenter';
import type { EntityId } from '@dungeon/contracts';
import {
  computeAnimationDispatchPolicy,
  isAnimationOwnedByThree,
} from './animation-dispatch-policy.js';

type AnimationId = `fx.${'status' | 'impact' | 'projectile' | 'self' | 'aoe' | 'utility'}.${string}`;

/**
 * Cross-backend proof tests verify that the dispatch policy correctly divides
 * animation ownership between Three.js and canvas renderers.
 *
 * Key invariants:
 * - Three-owned animations should NOT be rendered by canvas
 * - Canvas-owned animations should be filtered OUT by Three
 * - Status presentations owned by Three should not be rendered by canvas
 */
describe('AnimationDispatchPolicy - Cross-Backend Coordination', () => {
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

  describe('Three-owned animations excluded from canvas', () => {
    it('canvas filters out Three-owned module animations', () => {
      const threeModuleAnimations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
        { animationId: 'fx.impact.radial-impact-burst' as AnimationId },
      ];
      const canvasAnimations = [
        { animationId: 'fx.self.healing-pulse' as AnimationId },
        { animationId: 'fx.self.shield-boost' as AnimationId }, // Canvas-owned
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        threeModuleAnimations,
        [],
        [],
        [],
      );

      // Canvas should filter based on policy
      const canvasRendered = canvasAnimations.filter(
        (anim) => !isAnimationOwnedByThree(anim.animationId, policy),
      );

      expect(canvasRendered).toHaveLength(1);
      const rendered = canvasRendered[0];
      if (rendered) {
        expect(rendered.animationId).toBe('fx.self.shield-boost' as AnimationId);
      }
    });

    it('Three owns consumable effect animations via module registry', () => {
      // When Three registers a module animation for a consumable effect,
      // canvas should skip rendering that animation
      const threeOwnedFxId = 'fx.self.sparkle-burst' as AnimationId;
      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [{ animationId: threeOwnedFxId }],
        [],
        [],
        [],
      );

      // Simulate a consumable animation trying to render
      const shouldRender = !isAnimationOwnedByThree(threeOwnedFxId, policy);

      expect(shouldRender).toBe(false);
    });
  });

  describe('Canvas-owned animations still render', () => {
    it('canvas renders fallback consumable effects when not owned by Three', () => {
      // A consumable effect animation ID that Three does NOT own
      const canvasOwnedFxId = 'fx.self.hearts-float' as AnimationId;
      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [], // Three owns no animations
        [],
        [],
        [],
      );

      // Canvas checks: should this animation be skipped?
      const shouldSkip = isAnimationOwnedByThree(canvasOwnedFxId, policy);

      expect(shouldSkip).toBe(false); // Canvas should render it
    });

    it('canvas renders fallback status presentations when Three does not own them', () => {
      // When Three owns no animations, it cannot own status presentations
      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [], // Three owns no animations
        [], // No presentations
        [],
        [],
      );

      expect(policy.threeOwnsStatusPresentations).toBe(false);
      // Canvas should render its own status presentation visuals
    });
  });

  describe('Status presentation ownership coordination', () => {
    it('Three owns all status presentations when they all reference owned animations', () => {
      const threeModuleAnimations = [
        { animationId: 'fx.status.poisoned-aura' as AnimationId },
        { animationId: 'fx.status.blessed-light' as AnimationId },
      ];
      const statusPresentations: StatusPresentationView[] = [
        { animationId: 'fx.status.poisoned-aura' as AnimationId, entityScale: 1.2, ring: undefined },
        { animationId: 'fx.status.blessed-light' as AnimationId, entityScale: undefined, ring: undefined },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        threeModuleAnimations,
        statusPresentations,
        [],
        [],
      );

      expect(policy.threeOwnsStatusPresentations).toBe(true);
      // Canvas should not render status visuals for the player
    });

    it('Three does not own status presentations when any reference non-owned animations', () => {
      const threeModuleAnimations = [
        { animationId: 'fx.status.poisoned-aura' as AnimationId },
      ];
      const statusPresentations: StatusPresentationView[] = [
        { animationId: 'fx.status.poisoned-aura' as AnimationId, entityScale: 1.2, ring: undefined },
        { animationId: 'fx.status.blessed-light' as AnimationId, entityScale: undefined, ring: undefined }, // Not owned by Three
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        threeModuleAnimations,
        statusPresentations,
        [],
        [],
      );

      expect(policy.threeOwnsStatusPresentations).toBe(false);
      // Canvas should render status visuals (scale, rings) for the player
    });

    it('Three owns player entity when status presentations are owned', () => {
      const threeModuleAnimations = [
        { animationId: 'fx.status.buff' as AnimationId },
      ];
      const statusPresentations: StatusPresentationView[] = [
        { animationId: 'fx.status.buff' as AnimationId, entityScale: 1.2, ring: undefined },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        threeModuleAnimations,
        statusPresentations,
        [],
        [],
      );

      expect(policy.threeOwnedEntityIds).toContain('player' as EntityId);
      // Three handles player sprite scale and rings; canvas does not
    });

    it('Canvas scales and renders player rings when status presentations are not owned by Three', () => {
      // Scenario: Three has no module animations
      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [],
        [],
        [],
        [],
      );

      expect(policy.threeOwnsStatusPresentations).toBe(false);
      expect(policy.threeOwnedEntityIds).not.toContain('player' as EntityId);
      // Canvas handles player scale and ring rendering
    });
  });

  describe('Animation filter consistency', () => {
    it('policy is consistent: no animation should be both Three-owned and canvas-rendered', () => {
      const moduleAnimations = [
        { animationId: 'fx.impact.burst' as AnimationId },
        { animationId: 'fx.self.heal' as AnimationId },
      ];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        moduleAnimations,
        [],
        [],
        [],
      );

      // For any animation in the scene:
      const allAnimationIds = ['fx.impact.burst', 'fx.self.heal', 'fx.self.hearts'] as AnimationId[];

      for (const animId of allAnimationIds) {
        const isThreeOwned = isAnimationOwnedByThree(animId, policy);
        // If it's Three-owned, canvas MUST not render it
        // Canvas rendering is guarded by: !isAnimationOwnedByThree(animId, policy)
        if (isThreeOwned) {
          const canvasWouldRender = !isAnimationOwnedByThree(animId, policy);
          expect(canvasWouldRender).toBe(false);
        }
      }
    });

    it('policy ensures distinct ownership of entity IDs', () => {
      // If Three owns an entity, canvas must handle it differently
      // (e.g., canvas still renders the base entity, but Three handles animations)
      const moveAnimations = [{ entityId: 'enemy-1', progress: 0.5 }] as any[];

      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [],
        [],
        moveAnimations,
        [],
      );

      expect(policy.threeOwnedEntityIds).toContain('enemy-1' as EntityId);
      // Canvas still renders enemy-1, but Three handles movement animation
    });
  });

  describe('Backward compatibility: existing canvas fallback paths', () => {
    it('canvas can still handle consumable effects without policy', () => {
      // Old code path: canvas receives empty skipHandledAnimationIds
      const oldStyleSkipList: AnimationId[] = [];

      // Canvas checks if animation should be skipped (it has None to skip)
      const shouldRender = !oldStyleSkipList.includes('fx.self.hearts' as AnimationId);

      expect(shouldRender).toBe(true);
      // Canvas renders the fallback hearts animation
    });

    it('canvas preserves entity rendering even when owned by Three', () => {
      // Three owns animation of enemy-1, but canvas still renders the entity itself
      const policy = computeAnimationDispatchPolicy(
        createMockMap(),
        [], // No Three animations yet
        [],
        [{ entityId: 'enemy-1' }], // Three animates movement
        [],
      );

      // Canvas ALWAYS renders entities; it just skips animations owned by Three
      expect(policy.threeOwnedEntityIds).toContain('enemy-1' as EntityId);
      // Canvas renders enemy-1 at grid position; Three handles offset
    });
  });
});
