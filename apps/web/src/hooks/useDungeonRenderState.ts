import { useEffect, useMemo, useRef } from 'react';
import {
  getAnimatedEventBatchSettleMs,
  type AbilityAnimationEntry,
  type AnimatedEvent,
  type EntityView,
  type MapView,
  type MoveAnimationEntry,
  type StatusPresentationView,
  type StatusView,
} from '@dungeon/presenter';
import { useBumpAnimationState } from './useBumpAnimationState.js';
import { useMoveAnimationState } from './useMoveAnimationState.js';
import { useConsumableAnimationState } from './useConsumableAnimationState.js';
import { useFxAnimationState } from './useFxAnimationState.js';
import { getMoveTravelOffsetPx } from '../animations/move-style-profiles.js';
import { CELL_SIZE } from '../config/ui-config.js';
import { useGameStore } from '../store/game-store.js';

const EMPTY_STATUSES: readonly StatusView[] = [];
const EMPTY_ANIMATED_EVENTS: readonly AnimatedEvent[] = [];
const ZERO_CAMERA_OFFSET = { x: 0, y: 0 } as const;

interface RetainedBatchState {
  readonly batchId: string;
  readonly sourceMap: MapView;
  readonly startedAtMs: number;
  readonly settleMs: number;
}

interface DefenderHitAnimationEntry {
  readonly entityId: string;
  readonly durationMs: number;
}

export interface DungeonRenderState {
  displayMap: MapView;
  bumpAnimations: ReturnType<typeof useBumpAnimationState>['animations'];
  moveAnimations: ReturnType<typeof useMoveAnimationState>['animations'];
  consumableAnimations: ReturnType<typeof useConsumableAnimationState>['animations'];
  fxAnimations: ReturnType<typeof useFxAnimationState>['animations'];
  statusPresentations: readonly StatusPresentationView[];
  vpLeft: number;
  vpTop: number;
  cameraOffset: { readonly x: number; readonly y: number };
}

function positionKey(position: { readonly x: number; readonly y: number }): string {
  return `${position.x},${position.y}`;
}

function getAbilityRetentionPositions(
  animation: AbilityAnimationEntry,
): readonly { readonly x: number; readonly y: number }[] {
  const mutablePositions = animation.targetPos === undefined
    ? [...animation.blastPositions]
    : [animation.targetPos, ...animation.blastPositions];
  const seen = new Set<string>();

  return mutablePositions.filter((position) => {
    const key = positionKey(position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function deriveDisplayMap(
  map: MapView,
  animatedEvents: readonly AnimatedEvent[],
  retainedBatch: RetainedBatchState | null,
): MapView {
  if (retainedBatch === null || animatedEvents.length === 0) {
    return map;
  }

  const elapsedMs = Date.now() - retainedBatch.startedAtMs;
  if (elapsedMs < 0 || elapsedMs >= retainedBatch.settleMs) {
    return map;
  }

  const currentEntitiesById = new Map(map.entities.map((entity) => [entity.id, entity]));
  const previousEntitiesById = new Map(retainedBatch.sourceMap.entities.map((entity) => [entity.id, entity]));
  const previousEntitiesByPosition = new Map(
    retainedBatch.sourceMap.entities.map((entity) => [positionKey(entity), entity]),
  );
  const retainedEntitiesById = new Map<string, EntityView>();

  for (const event of animatedEvents) {
    if (event.type === 'move' && elapsedMs < event.delayMs) {
      const move = event.data as MoveAnimationEntry;
      const previousEntity = previousEntitiesById.get(move.entityId);
      const currentEntity = currentEntitiesById.get(move.entityId);
      const retainedEntity = previousEntity ?? (
        currentEntity === undefined
          ? undefined
          : { ...currentEntity, x: move.fromPos.x, y: move.fromPos.y }
      );
      if (retainedEntity !== undefined) {
        retainedEntitiesById.set(move.entityId, retainedEntity);
      }
      continue;
    }

    if (event.type === 'ability') {
      const ability = event.data as AbilityAnimationEntry;
      if (elapsedMs >= event.delayMs + ability.durationMs) {
        continue;
      }

      for (const position of getAbilityRetentionPositions(ability)) {
        const previousEntity = previousEntitiesByPosition.get(positionKey(position));
        if (previousEntity !== undefined && !currentEntitiesById.has(previousEntity.id)) {
          retainedEntitiesById.set(previousEntity.id, previousEntity);
        }
      }
      continue;
    }

    if (event.type === 'defender-hit') {
      const defenderHit = event.data as DefenderHitAnimationEntry;
      if (elapsedMs >= event.delayMs + defenderHit.durationMs) {
        continue;
      }

      const previousEntity = previousEntitiesById.get(defenderHit.entityId);
      if (previousEntity !== undefined && !currentEntitiesById.has(previousEntity.id)) {
        retainedEntitiesById.set(previousEntity.id, previousEntity);
      }
    }
  }

  if (retainedEntitiesById.size === 0) {
    return map;
  }

  const mutableEntities = map.entities.filter((entity) => !retainedEntitiesById.has(entity.id));
  for (const previousEntity of retainedBatch.sourceMap.entities) {
    const retainedEntity = retainedEntitiesById.get(previousEntity.id);
    if (retainedEntity !== undefined) {
      mutableEntities.push(retainedEntity);
    }
  }

  return {
    ...map,
    entities: mutableEntities,
  };
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
  const animatedEvents = useGameStore((s) => s.view?.animatedEvents ?? EMPTY_ANIMATED_EVENTS);
  const previousMapRef = useRef(map);
  const retainedBatchRef = useRef<RetainedBatchState | null>(null);
  const statusPresentations: readonly StatusPresentationView[] = useMemo(
    () =>
      playerStatuses
        .map((status) => status.presentation)
        .filter((p): p is StatusPresentationView => p !== undefined),
    [playerStatuses],
  );
  const currentBatchId = animatedEvents[0]?.batchId ?? null;
  const retainedBatch = useMemo(
    () =>
      currentBatchId !== null && retainedBatchRef.current?.batchId !== currentBatchId
        ? {
            batchId: currentBatchId,
            sourceMap: previousMapRef.current,
            startedAtMs: Date.now(),
            settleMs: getAnimatedEventBatchSettleMs(animatedEvents),
          }
        : retainedBatchRef.current,
    [animatedEvents, currentBatchId],
  );
  const displayMap = deriveDisplayMap(map, animatedEvents, retainedBatch);

  useEffect(() => {
    retainedBatchRef.current = retainedBatch;
    previousMapRef.current = map;
  }, [map, retainedBatch]);

  const { vpLeft, vpTop, cameraOffset } = useMemo(() => {
    const minX = displayMap.cells.length > 0 ? Math.min(...displayMap.cells.map((c) => c.x)) : 0;
    const minY = displayMap.cells.length > 0 ? Math.min(...displayMap.cells.map((c) => c.y)) : 0;

    const idealVpLeft = displayMap.playerPosition.x - Math.floor(vpTilesWidth / 2);
    const idealVpTop = displayMap.playerPosition.y - Math.floor(vpTilesHeight / 2);

    const vpLeft = Math.max(minX, idealVpLeft);
    const vpTop = Math.max(minY, idealVpTop);

    const playerEntityId = displayMap.entities.find((entity) => entity.type === 'player')?.id;
    const activePlayerMove = playerEntityId === undefined
      ? moveAnimations.find(
          (animation) =>
            animation.toPos.x === displayMap.playerPosition.x
            && animation.toPos.y === displayMap.playerPosition.y,
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
  }, [displayMap, moveAnimations, vpTilesWidth, vpTilesHeight]);

  return {
    displayMap,
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
