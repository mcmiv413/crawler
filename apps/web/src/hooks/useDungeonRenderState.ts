import { useMemo } from 'react';
import type { MapView, StatusPresentationView, StatusView } from '@dungeon/presenter';
import { useBumpAnimationState } from './useBumpAnimationState.js';
import { useMoveAnimationState } from './useMoveAnimationState.js';
import { useConsumableAnimationState } from './useConsumableAnimationState.js';
import { useFxAnimationState } from './useFxAnimationState.js';
import { useGameStore } from '../store/game-store.js';

const EMPTY_STATUSES: readonly StatusView[] = [];
const ZERO_CAMERA_OFFSET = { x: 0, y: 0 } as const;

export interface DungeonRenderState {
  bumpAnimations: ReturnType<typeof useBumpAnimationState>['animations'];
  moveAnimations: ReturnType<typeof useMoveAnimationState>['animations'];
  consumableAnimations: ReturnType<typeof useConsumableAnimationState>['animations'];
  fxAnimations: ReturnType<typeof useFxAnimationState>['animations'];
  statusPresentations: readonly StatusPresentationView[];
  vpLeft: number;
  vpTop: number;
  cameraOffset: { readonly x: number; readonly y: number };
}

export function useDungeonRenderState(
  map: MapView,
  vpTilesWidth: number,
  vpTilesHeight: number,
): DungeonRenderState {
  const { animations: bumpAnimations } = useBumpAnimationState();
  const { animations: moveAnimations } = useMoveAnimationState();
  const { animations: consumableAnimations } = useConsumableAnimationState();
  const { animations: fxAnimations } = useFxAnimationState();

  const playerStatuses = useGameStore((s) => s.view?.player.statuses ?? EMPTY_STATUSES);
  const statusPresentations: readonly StatusPresentationView[] = useMemo(
    () =>
      playerStatuses
        .map((status) => status.presentation)
        .filter((p): p is StatusPresentationView => p !== undefined),
    [playerStatuses],
  );

  const { vpLeft, vpTop, cameraOffset } = useMemo(() => {
    const minX = map.cells.length > 0 ? Math.min(...map.cells.map((c) => c.x)) : 0;
    const minY = map.cells.length > 0 ? Math.min(...map.cells.map((c) => c.y)) : 0;
    
    const halfWidth = vpTilesWidth / 2;
    const halfHeight = vpTilesHeight / 2;
    
    const idealVpLeft = map.playerPosition.x - halfWidth;
    const idealVpTop = map.playerPosition.y - halfHeight;
    
    const vpLeft = Math.max(minX, Math.floor(idealVpLeft));
    const vpTop = Math.max(minY, Math.floor(idealVpTop));
    
    // Camera offset represents the fractional tile offset needed to center the player
    // when the viewport dimensions are odd. This occurs when ideal viewport position
    // has a fractional component due to odd-width viewports.
    const offsetX = idealVpLeft - vpLeft;
    const offsetY = idealVpTop - vpTop;
    
    return {
      vpLeft,
      vpTop,
      cameraOffset: { x: offsetX, y: offsetY },
    };
  }, [map, vpTilesWidth, vpTilesHeight]);

  return {
    bumpAnimations,
    moveAnimations,
    consumableAnimations,
    fxAnimations,
    statusPresentations,
    vpLeft,
    vpTop,
    cameraOffset,
  };
}
