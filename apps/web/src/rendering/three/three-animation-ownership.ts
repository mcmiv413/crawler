import type { AnimationId } from '@dungeon/content';
import type { EntityId } from '@dungeon/contracts';

export interface AnimationOwnershipState {
  readonly animationIds: readonly AnimationId[];
  readonly entityIds: readonly EntityId[];
  readonly statusPresentation: boolean;
  readonly combatIndicators: boolean;
}

interface ThreeOwnershipReport {
  readonly animationIds: readonly AnimationId[];
  readonly entityIds: readonly EntityId[];
  readonly statusPresentation: boolean;
  readonly combatIndicators: boolean;
}

export function createAnimationOwnershipState(): AnimationOwnershipState {
  return {
    animationIds: [],
    entityIds: [],
    statusPresentation: false,
    combatIndicators: false,
  };
}

export function reportThreeOwnership(
  state: AnimationOwnershipState,
  report: ThreeOwnershipReport,
): AnimationOwnershipState {
  return {
    animationIds: report.animationIds,
    entityIds: report.entityIds,
    statusPresentation: report.statusPresentation,
    combatIndicators: report.combatIndicators,
  };
}

export function getThreeOwnedAnimationIds(state: AnimationOwnershipState): readonly AnimationId[] {
  return state.animationIds;
}

export function getThreeOwnedEntityIds(state: AnimationOwnershipState): readonly EntityId[] {
  return state.entityIds;
}

export function isStatusPresentationOwnedByThree(state: AnimationOwnershipState): boolean {
  return state.statusPresentation;
}

export function areCombatIndicatorsOwnedByThree(state: AnimationOwnershipState): boolean {
  return state.combatIndicators;
}
