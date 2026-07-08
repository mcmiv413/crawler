/**
 * Test layer: unit
 * Behavior: Transient animation ownership resolves unique registered animation IDs and replaces stored ownership immutably across reportThreeOwnership calls.
 * Proof: Assertions check empty, registered, unregistered, duplicate, mixed, and high-volume owned ID arrays, prior-state preservation, replacement with ID_AOE, and clearing back to an empty owned-ID list.
 * Validation: pnpm vitest run apps/web/src/rendering/three/three-transient-animation-ownership.test.ts
 */
/**
 * Workstream 5: Transient animation ownership tests.
 *
 * Verifies that the ownership state correctly tracks transient consumable/fx
 * animations by animation ID (not array index), and that multiple simultaneous
 * animations with the same animationId are owned as a single ID entry.
 *
 * Key contracts:
 *  - Each unique animationId is owned once regardless of instance count
 *  - Animations without a registered module are NOT included in owned IDs
 *  - Two animations with different animationIds both appear in owned set
 *  - Empty animation arrays produce empty ownership
 *  - Ownership replaces prior state on each report (immutable)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createAnimationOwnershipState,
  reportThreeOwnership,
  getThreeOwnedAnimationIds,
} from './three-animation-ownership.js';

type AnimationId = `fx.${'status' | 'impact' | 'projectile' | 'self' | 'aoe' | 'utility'}.${string}`;

// ---------------------------------------------------------------------------
// Helpers — stable test IDs, no live content imports
// ---------------------------------------------------------------------------

const ID_HEAL = 'fx.self.healing-pulse' as AnimationId;
const ID_IMPACT = 'fx.impact.radial-impact-burst' as AnimationId;
const ID_AOE = 'fx.aoe.bomb-blast' as AnimationId;

/**
 * Simulate the set of animationIds that Three would own when the overlay
 * resolves which animations have registered modules.
 * This mirrors the logic in ThreeAnimationOverlay.resolveHandledAnimations.
 */
function resolveOwnedIds(
  animations: ReadonlyArray<{ animationId: AnimationId }>,
  registeredIds: ReadonlySet<AnimationId>,
): AnimationId[] {
  const seen = new Set<AnimationId>();
  for (const anim of animations) {
    if (registeredIds.has(anim.animationId)) {
      seen.add(anim.animationId);
    }
  }
  return [...seen];
}

describe('Transient animation ownership — ID-based keying', () => {
  let state: ReturnType<typeof createAnimationOwnershipState>;

  beforeEach(() => {
    state = createAnimationOwnershipState();
  });

  it('resolves empty owned IDs when no animations are active', () => {
    const registeredIds = new Set([ID_HEAL, ID_IMPACT] as AnimationId[]);
    const ownedIds = resolveOwnedIds([], registeredIds);
    expect(ownedIds).toEqual([]);
  });

  it('owns a single animationId when one animation is active with a registered module', () => {
    const registeredIds = new Set([ID_HEAL] as AnimationId[]);
    const anims = [{ animationId: ID_HEAL }];
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toEqual([ID_HEAL]);
  });

  it('does NOT own animationId when the module is not registered', () => {
    const registeredIds = new Set([] as AnimationId[]);
    const anims = [{ animationId: ID_HEAL }];
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toEqual([]);
  });

  it('deduplicates: two instances of the same animationId produce one owned entry', () => {
    const registeredIds = new Set([ID_HEAL] as AnimationId[]);
    const anims = [
      { animationId: ID_HEAL },
      { animationId: ID_HEAL },
    ];
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toHaveLength(1);
    expect(ownedIds).toContain(ID_HEAL);
  });

  it('includes all unique animationIds from mixed consumable and fx animations', () => {
    const registeredIds = new Set([ID_HEAL, ID_IMPACT, ID_AOE] as AnimationId[]);
    const anims = [
      { animationId: ID_HEAL },
      { animationId: ID_IMPACT },
      { animationId: ID_HEAL }, // duplicate — should still be deduplicated
    ];
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toHaveLength(2);
    expect(ownedIds).toContain(ID_HEAL);
    expect(ownedIds).toContain(ID_IMPACT);
    expect(ownedIds).not.toContain(ID_AOE);
  });

  it('only owns animations whose IDs are in the registered set', () => {
    const registeredIds = new Set([ID_IMPACT] as AnimationId[]);
    const anims = [
      { animationId: ID_HEAL },   // not registered
      { animationId: ID_IMPACT }, // registered
      { animationId: ID_AOE },    // not registered
    ];
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toEqual([ID_IMPACT]);
  });

  it('handles 100 simultaneous animations (same ID) — deduplicates to 1', () => {
    const registeredIds = new Set([ID_HEAL] as AnimationId[]);
    const anims = Array.from({ length: 100 }, () => ({ animationId: ID_HEAL }));
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toHaveLength(1);
  });

  it('handles 100 simultaneous animations (all 3 IDs) — deduplicates to 3', () => {
    const registeredIds = new Set([ID_HEAL, ID_IMPACT, ID_AOE] as AnimationId[]);
    const ids = [ID_HEAL, ID_IMPACT, ID_AOE] as const;
    const anims = Array.from({ length: 99 }, (_, i) => ({ animationId: ids[i % 3]! }));
    const ownedIds = resolveOwnedIds(anims, registeredIds);
    expect(ownedIds).toHaveLength(3);
  });
});

describe('Transient animation ownership — reportThreeOwnership integration', () => {
  it('reportThreeOwnership stores resolved transient IDs immutably', () => {
    const state = createAnimationOwnershipState();
    const transientIds: AnimationId[] = [ID_HEAL, ID_IMPACT];

    const newState = reportThreeOwnership(state, {
      animationIds: transientIds,
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });

    // Original state unchanged
    expect(getThreeOwnedAnimationIds(state)).toEqual([]);
    // New state has transient IDs
    expect(getThreeOwnedAnimationIds(newState)).toEqual(transientIds);
  });

  it('replacing transient IDs clears prior animation ownership', () => {
    let state = createAnimationOwnershipState();
    state = reportThreeOwnership(state, {
      animationIds: [ID_HEAL, ID_IMPACT],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });
    state = reportThreeOwnership(state, {
      animationIds: [ID_AOE],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });

    const owned = getThreeOwnedAnimationIds(state);
    expect(owned).toEqual([ID_AOE]);
    expect(owned).not.toContain(ID_HEAL);
    expect(owned).not.toContain(ID_IMPACT);
  });

  it('clearing to empty array removes all prior transient ownership', () => {
    let state = createAnimationOwnershipState();
    state = reportThreeOwnership(state, {
      animationIds: [ID_HEAL],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });
    state = reportThreeOwnership(state, {
      animationIds: [],
      entityIds: [],
      statusPresentation: false,
      combatIndicators: false,
    });

    expect(getThreeOwnedAnimationIds(state)).toEqual([]);
  });
});
