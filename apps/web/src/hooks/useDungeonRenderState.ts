import { useMemo } from 'react';
import type { MapView, StatusPresentationView, StatusView } from '@dungeon/presenter';
import { useBumpAnimationState } from './useBumpAnimationState.js';
import { useMoveAnimationState } from './useMoveAnimationState.js';
import { useConsumableAnimationState } from './useConsumableAnimationState.js';
import { useFxAnimationState } from './useFxAnimationState.js';
import { getMoveTravelOffsetPx } from '../animations/move-style-profiles.js';
import { CELL_SIZE } from '../config/ui-config.js';
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

    const idealVpLeft = map.playerPosition.x - Math.floor(vpTilesWidth / 2);
    const idealVpTop = map.playerPosition.y - Math.floor(vpTilesHeight / 2);

    const vpLeft = Math.max(minX, idealVpLeft);
    const vpTop = Math.max(minY, idealVpTop);

    const playerEntityId = map.entities.find((entity) => entity.type === 'player')?.id;
    const activePlayerMove = playerEntityId === undefined
      ? moveAnimations.find(
          (animation) =>
            animation.toPos.x === map.playerPosition.x
            && animation.toPos.y === map.playerPosition.y,
        )
      : moveAnimations.find((animation) => animation.entityId === playerEntityId);

    const cameraOffset = activePlayerMove === undefined
      ? ZERO_CAMERA_OFFSET
      : (() => {
          const offset = getMoveTravelOffsetPx(activePlayerMove, CELL_SIZE);
          return {
            x: -offset.x,
            y: -offset.y,
          };
        })();

    return {
      vpLeft,
      vpTop,
      cameraOffset,
    };
  }, [map, moveAnimations, vpTilesWidth, vpTilesHeight]);

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
