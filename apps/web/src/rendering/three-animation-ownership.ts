import type { AnimationId } from '@dungeon/content';
import type { EntityId } from '@dungeon/contracts';

export interface AnimationOwnershipState {
  readonly animationIds: readonly AnimationId[];
  readonly entityIds: readonly EntityId[];
  readonly statusPresentation: boolean;
  readonly combatIndicators: boolean;
}

export interface ThreeOwnershipReport {
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
  if (
    areArraysEqual(state.animationIds, report.animationIds)
    && areArraysEqual(state.entityIds, report.entityIds)
    && state.statusPresentation === report.statusPresentation
    && state.combatIndicators === report.combatIndicators
  ) {
    return state;
  }

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

function areArraysEqual<T>(left: readonly T[], right: readonly T[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}
