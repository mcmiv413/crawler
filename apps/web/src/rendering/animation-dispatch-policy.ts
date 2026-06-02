import type { MapView } from '@dungeon/presenter';
import type { StatusPresentationView } from '@dungeon/presenter';
import type { AnimationId } from '@dungeon/content';
import type { EntityId } from '@dungeon/contracts';


/**
 * Centralized policy for which animations are owned/dispatched by Three.js vs canvas.
 * Both renderers consume this policy to avoid duplicate ownership decisions.
 */
export interface AnimationDispatchPolicy {
  readonly threeOwnedAnimationIds: readonly AnimationId[];
  readonly threeOwnedEntityIds: readonly EntityId[];
  readonly threeOwnsStatusPresentations: boolean;
  readonly threeOwnsCombatIndicators: boolean;
}

/**
 * Compute which animation IDs are owned by Three.js based on module animations it handles.
 */
export function getThreeOwnedAnimationIds(
  moduleAnimations: readonly { animationId: AnimationId }[],
): AnimationId[] {
  const result: AnimationId[] = [];
  const seen = new Set<AnimationId>();
  for (const animation of moduleAnimations) {
    if (!seen.has(animation.animationId)) {
      seen.add(animation.animationId);
      result.push(animation.animationId);
    }
  }
  return result;
}

/**
 * Check if all status presentations have animation IDs owned by Three.
 */
export function areAllStatusPresentationsOwnedByThree(
  statusPresentations: readonly StatusPresentationView[],
  threeOwnedAnimationIds: readonly AnimationId[],
): boolean {
  if (statusPresentations.length === 0) {
    return false;
  }

  const ownedIdSet = new Set(threeOwnedAnimationIds);
  return statusPresentations.every((presentation) =>
    presentation.animationId !== undefined
    && ownedIdSet.has(presentation.animationId as AnimationId),
  );
}



/**
 * Animation state for a move.
 */
export interface MoveAnimationInput {
  readonly entityId: string;
}

/**
 * Animation state for a bump.
 */
export interface BumpAnimationInput {
  readonly attackerId: string;
}

/**
 * Compute which entities are owned by Three.js (those with active move/bump animations or status presentations).
 */
export function getThreeOwnedEntityIds(
  map: MapView | null,
  moveAnimations: readonly MoveAnimationInput[],
  bumpAnimations: readonly BumpAnimationInput[],
  statusPresentationOwned: boolean,
): EntityId[] {
  if (map === null) {
    return [];
  }

  const visibleEntityIds = new Set(map.entities.map((entity) => entity.id as EntityId));
  const owned: EntityId[] = [];
  const ownedSet = new Set<EntityId>();

  for (const move of moveAnimations) {
    const entityId = move.entityId as EntityId;
    if (visibleEntityIds.has(entityId) && !ownedSet.has(entityId)) {
      ownedSet.add(entityId);
      owned.push(entityId);
    }
  }

  for (const bump of bumpAnimations) {
    const entityId = bump.attackerId as EntityId;
    if (visibleEntityIds.has(entityId) && !ownedSet.has(entityId)) {
      ownedSet.add(entityId);
      owned.push(entityId);
    }
  }

  if (statusPresentationOwned) {
    const playerEntity = map.entities.find((entity) => entity.type === 'player');
    if (playerEntity !== undefined) {
      const playerId = playerEntity.id as EntityId;
      if (!ownedSet.has(playerId)) {
        owned.push(playerId);
      }
    }
  }

  return owned;
}

/**
 * Check if an animation ID is owned by Three.js.
 */
export function isAnimationOwnedByThree(
  animationId: AnimationId | undefined,
  ownedIdsOrPolicy: readonly AnimationId[] | AnimationDispatchPolicy,
): boolean {
  if (animationId === undefined) {
    return false;
  }

  if (Array.isArray(ownedIdsOrPolicy)) {
    return (ownedIdsOrPolicy as AnimationId[]).includes(animationId);
  }

  return (ownedIdsOrPolicy as AnimationDispatchPolicy).threeOwnedAnimationIds.includes(animationId);
}

/**
 * Compute the complete dispatch policy based on current render state.
 * This is the single source of truth for animation ownership decisions.
 */
export function computeAnimationDispatchPolicy(
  map: MapView | null,
  moduleAnimations: readonly { animationId: AnimationId }[],
  statusPresentations: readonly StatusPresentationView[],
  moveAnimations: readonly MoveAnimationInput[],
  bumpAnimations: readonly BumpAnimationInput[],
  combatIndicators: readonly { readonly id: string }[] = [],
): AnimationDispatchPolicy {
  const threeOwnedAnimationIds = getThreeOwnedAnimationIds(moduleAnimations);
  const threeOwnsStatusPresentations = areAllStatusPresentationsOwnedByThree(
    statusPresentations,
    threeOwnedAnimationIds,
  );
  const threeOwnedEntityIds = getThreeOwnedEntityIds(
    map,
    moveAnimations,
    bumpAnimations,
    threeOwnsStatusPresentations,
  );

  return {
    threeOwnedAnimationIds,
    threeOwnedEntityIds,
    threeOwnsStatusPresentations,
    threeOwnsCombatIndicators: combatIndicators.length > 0,
  };
}
