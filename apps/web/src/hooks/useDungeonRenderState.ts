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
import { applyMoveStyleEasing } from '../animations/move-style-profiles.js';
import { CELL_SIZE } from '../config/ui-config.js';
import { useGameStore } from '../store/game-store.js';
import type { ActiveMoveAnimation } from './useMoveAnimationState.js';

const EMPTY_STATUSES: readonly StatusView[] = [];
const EMPTY_ANIMATED_EVENTS: readonly AnimatedEvent[] = [];
const ZERO_CAMERA_OFFSET = { x: 0, y: 0 } as const;
const mapBoundsCache = new WeakMap<MapView, { readonly minX: number; readonly minY: number }>();

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

export function getViewportOriginForPosition(
  map: MapView,
  position: { readonly x: number; readonly y: number },
  vpTilesWidth: number,
  vpTilesHeight: number,
): { readonly vpLeft: number; readonly vpTop: number } {
  const { minX, minY } = getMapBounds(map);

  return {
    vpLeft: Math.max(minX, position.x - Math.floor(vpTilesWidth / 2)),
    vpTop: Math.max(minY, position.y - Math.floor(vpTilesHeight / 2)),
  };
}

function getMapBounds(map: MapView): { readonly minX: number; readonly minY: number } {
  const cachedBounds = mapBoundsCache.get(map);
  if (cachedBounds !== undefined) {
    return cachedBounds;
  }

  if (map.cells.length === 0) {
    const bounds = { minX: 0, minY: 0 };
    mapBoundsCache.set(map, bounds);
    return bounds;
  }

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  for (const cell of map.cells) {
    if (cell.x < minX) {
      minX = cell.x;
    }
    if (cell.y < minY) {
      minY = cell.y;
    }
  }

  const bounds = { minX, minY };
  mapBoundsCache.set(map, bounds);
  return bounds;
}

export function findActivePlayerMove(
  map: MapView,
  moveAnimations: readonly ActiveMoveAnimation[],
): ActiveMoveAnimation | undefined {
  const playerEntityId = map.entities.find((entity) => entity.type === 'player')?.id;
  return playerEntityId === undefined
    ? moveAnimations.find(
        (animation) =>
          animation.toPos.x === map.playerPosition.x
          && animation.toPos.y === map.playerPosition.y,
      )
    : moveAnimations.find((animation) => animation.entityId === playerEntityId);
}

export function getCameraOffsetForPlayerMove(
  map: MapView,
  vpTilesWidth: number,
  vpTilesHeight: number,
  move: ActiveMoveAnimation | undefined,
  cellSize: number = CELL_SIZE,
): { readonly x: number; readonly y: number } {
  if (move === undefined) {
    return ZERO_CAMERA_OFFSET;
  }

  const fromOrigin = getViewportOriginForPosition(map, move.fromPos, vpTilesWidth, vpTilesHeight);
  const toOrigin = getViewportOriginForPosition(map, move.toPos, vpTilesWidth, vpTilesHeight);
  const easedProgress = applyMoveStyleEasing(move.style, move.progress, move.walkPhase);
  const remaining = 1 - easedProgress;

  return {
    x: (toOrigin.vpLeft - fromOrigin.vpLeft) * cellSize * remaining,
    y: (toOrigin.vpTop - fromOrigin.vpTop) * cellSize * remaining,
  };
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
    const { vpLeft, vpTop } = getViewportOriginForPosition(
      displayMap,
      displayMap.playerPosition,
      vpTilesWidth,
      vpTilesHeight,
    );
    const activePlayerMove = findActivePlayerMove(displayMap, moveAnimations);
    const cameraOffset = getCameraOffsetForPlayerMove(
      displayMap,
      vpTilesWidth,
      vpTilesHeight,
      activePlayerMove,
    );

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
