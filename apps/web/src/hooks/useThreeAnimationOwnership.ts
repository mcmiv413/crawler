import { useState, useCallback } from 'react';
import {
  createAnimationOwnershipState,
  reportThreeOwnership,
  getThreeOwnedAnimationIds,
  getThreeOwnedEntityIds,
  isStatusPresentationOwnedByThree,
  areCombatIndicatorsOwnedByThree,
  type AnimationOwnershipState,
  type ThreeOwnershipReport,
} from '../rendering/three-animation-ownership.js';
import type { AnimationId } from '@dungeon/content';
import type { EntityId } from '@dungeon/contracts';

interface UseThreeAnimationOwnershipReturn {
  readonly ownershipState: AnimationOwnershipState;
  readonly reportOwnership: (report: ThreeOwnershipReport) => void;
  readonly ownedAnimationIds: readonly AnimationId[];
  readonly ownedEntityIds: readonly EntityId[];
  readonly statusPresentationOwnedByThree: boolean;
  readonly combatIndicatorsOwnedByThree: boolean;
}

export function useThreeAnimationOwnership(): UseThreeAnimationOwnershipReturn {
  const [ownershipState, setOwnershipState] = useState(() => createAnimationOwnershipState());

  const reportOwnership = useCallback((report: ThreeOwnershipReport) => {
    setOwnershipState((prevState) => reportThreeOwnership(prevState, report));
  }, []);

  return {
    ownershipState,
    reportOwnership,
    ownedAnimationIds: getThreeOwnedAnimationIds(ownershipState),
    ownedEntityIds: getThreeOwnedEntityIds(ownershipState),
    statusPresentationOwnedByThree: isStatusPresentationOwnedByThree(ownershipState),
    combatIndicatorsOwnedByThree: areCombatIndicatorsOwnedByThree(ownershipState),
  };
}
