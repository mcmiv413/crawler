import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { EntityId } from '@dungeon/contracts';
import { ANIMATION_REF_BY_ID, type AnimationId } from '@dungeon/content';
import type { MapView, StatusPresentationView } from '@dungeon/presenter';
import { CELL_SIZE, COMBAT_INDICATOR_FADEOUT_MS } from '../../config/ui-config.js';
import { getMoveRenderedOffsetPx, getSquashStretchScale } from '../../animations/move-style-profiles.js';
import type { FloatingCombatIndicator } from '../../hooks/useCombatIndicatorState.js';
import type { DefenderHitEntry } from '../../hooks/useDefenderHitState.js';
import {
  findActivePlayerMove,
  getCameraOffsetForPlayerMove,
  type DungeonRenderState,
} from '../../hooks/useDungeonRenderState.js';
import { resolveMoveAnimationProgress } from '../../hooks/useMoveAnimationState.js';
import { createThreeRenderer } from './three-renderer-factory.js';
import type { ThreeRendererHandle } from './three-renderer-factory.js';
import { getAnimationModule } from './three-animation-registry.js';
import type { ThreeAnimationModule } from './three-animation-types.js';
import type { ThreeOwnershipReport } from '../three-animation-ownership.js';
import { computeAnimationDispatchPolicy } from '../animation-dispatch-policy.js';
import { tileCenterWorld, worldToScreen } from './three-coordinate-utils.js';
import { computeBumpScreenPosition } from './entities/three-entity-motion.js';
import {
  applyEntitySpriteAppearance,
  createEntitySprite,
  disposeEntitySprite,
  setEntitySpritePosition,
  setEntitySpriteScale,
  type EntitySprite,
} from './entities/three-entity-sprite.js';
import {
  createDefenderHitFlash,
  disposeDefenderHitFlash,
  setDefenderHitFlashPosition,
  updateDefenderHitFlash,
  type DefenderHitFlash,
} from './entities/three-defender-hit-flash.js';
import {
  createCombatLabel,
  disposeCombatLabel,
  setCombatLabelOpacity,
  setCombatLabelPosition,
  type CombatLabel,
} from './text/three-combat-label.js';
import {
  createAtmosphereVignette,
  type AtmosphereVignette,
} from './lib/atmosphere-plane.js';

type CreateRendererFn = (canvas: HTMLCanvasElement) => ThreeRendererHandle | null;

type OverlayAnimation =
  | DungeonRenderState['consumableAnimations'][number]
  | DungeonRenderState['fxAnimations'][number];

interface AnimationEntry {
  readonly instance: unknown;
  readonly module: ThreeAnimationModule;
}

interface CombatLabelEntry {
  readonly label: CombatLabel;
}

interface EntitySpriteEntry {
  readonly sprite: EntitySprite;
}

interface DefenderHitFlashEntry {
  readonly flash: DefenderHitFlash;
}

export interface ResolvedModuleAnimation {
  readonly key: string;
  readonly animationId: AnimationId;
  readonly module: ThreeAnimationModule;
  readonly position: { readonly x: number; readonly y: number };
  readonly sourcePosition?: { readonly x: number; readonly y: number };
  readonly targetPosition?: { readonly x: number; readonly y: number };
  readonly progress: number;
  readonly loopDurationMs?: number;
}

interface FrameState {
  readonly map: MapView | null;
  readonly moduleAnimations: readonly ResolvedModuleAnimation[];
  readonly ownedEntityIds: readonly EntityId[];
  readonly statusPresentations: readonly StatusPresentationView[];
  readonly statusPresentationOwned: boolean;
  readonly moveAnimations: DungeonRenderState['moveAnimations'];
  readonly bumpAnimations: DungeonRenderState['bumpAnimations'];
  readonly defenderHits: ReadonlyMap<EntityId, DefenderHitEntry>;
  readonly combatIndicators: readonly FloatingCombatIndicator[];
  readonly vpLeft: number;
  readonly vpTop: number;
  readonly cameraOffset: { readonly x: number; readonly y: number };
  readonly canvasWidth: number;
  readonly canvasHeight: number;
  readonly vpTilesWidth: number;
  readonly vpTilesHeight: number;
}

const EMPTY_MOVE_ANIMATIONS: DungeonRenderState['moveAnimations'] = [];
const EMPTY_BUMP_ANIMATIONS: DungeonRenderState['bumpAnimations'] = [];
const EMPTY_DEFENDER_HITS = new Map<EntityId, DefenderHitEntry>();

const EMPTY_FRAME_STATE: FrameState = {
  map: null,
  moduleAnimations: [],
  ownedEntityIds: [],
  statusPresentations: [],
  statusPresentationOwned: false,
  moveAnimations: EMPTY_MOVE_ANIMATIONS,
  bumpAnimations: EMPTY_BUMP_ANIMATIONS,
  defenderHits: EMPTY_DEFENDER_HITS,
  combatIndicators: [],
  vpLeft: 0,
  vpTop: 0,
  cameraOffset: { x: 0, y: 0 },
  canvasWidth: 0,
  canvasHeight: 0,
  vpTilesWidth: 0,
  vpTilesHeight: 0,
};

const EMPTY_OWNERSHIP_REPORT: ThreeOwnershipReport = {
  animationIds: [],
  entityIds: [],
  statusPresentation: false,
  combatIndicators: false,
};

const COMBAT_LABEL_COLORS = {
  damage: '#ff4444',
  heal: '#44ff44',
  status: '#ffaa44',
  gold: '#ffdd44',
} as const;

export function getOverlayPositions(
  animation: OverlayAnimation,
): readonly { readonly x: number; readonly y: number }[] {
  if (animation.blastPositions.length > 0) {
    return animation.blastPositions;
  }

  if ('targetPos' in animation && animation.targetPos !== undefined) {
    return [animation.targetPos];
  }

  if ('abilityId' in animation) {
    return animation.selfTargeted === true ? [animation.playerPos] : [];
  }

  return [animation.playerPos];
}

function getOverlayProjectileEndpoints(
  animationId: AnimationId,
  animation: OverlayAnimation,
): {
  readonly sourcePosition?: { readonly x: number; readonly y: number };
} {
  const ref = ANIMATION_REF_BY_ID.get(animationId);
  if (ref?.category !== 'projectile') {
    return {};
  }

  if (!('targetPos' in animation) || animation.targetPos === undefined) {
    return {};
  }

  return {
    sourcePosition: animation.playerPos,
  };
}

export function resolveThreeOwnedEntityIds(
  map: MapView | null,
  moveAnimations: DungeonRenderState['moveAnimations'],
  bumpAnimations: DungeonRenderState['bumpAnimations'],
  statusPresentationOwned = false,
): EntityId[] {
  if (map === null) {
    return [];
  }

  const visibleEntityIds = new Set(map.entities.map((entity) => entity.id as EntityId));
  const owned = new Set<EntityId>();

  for (const move of moveAnimations) {
    const entityId = move.entityId as EntityId;
    if (visibleEntityIds.has(entityId)) {
      owned.add(entityId);
    }
  }

  for (const bump of bumpAnimations) {
    const entityId = bump.attackerId as EntityId;
    if (visibleEntityIds.has(entityId)) {
      owned.add(entityId);
    }
  }

  if (statusPresentationOwned) {
    const playerEntity = map.entities.find((entity) => entity.type === 'player');
    if (playerEntity !== undefined) {
      owned.add(playerEntity.id as EntityId);
    }
  }

  return [...owned];
}

export function resolveHandledModuleAnimations(
  map: MapView | null,
  consumableAnimations: DungeonRenderState['consumableAnimations'],
  fxAnimations: DungeonRenderState['fxAnimations'],
  statusPresentations: DungeonRenderState['statusPresentations'],
  getModule: typeof getAnimationModule = getAnimationModule,
): ResolvedModuleAnimation[] {
  const resolved: ResolvedModuleAnimation[] = [];

  for (const animation of consumableAnimations) {
    if (animation.animationId === undefined) {
      continue;
    }

    const animationId = animation.animationId as AnimationId;
    const module = getModule(animationId);
    if (module === undefined) {
      continue;
    }
    const { sourcePosition } = getOverlayProjectileEndpoints(animationId, animation);

    getOverlayPositions(animation).forEach((position, index) => {
      resolved.push({
        key: `consumable-${animation.id}-${index}`,
        animationId,
        module,
        position,
        sourcePosition,
        targetPosition: sourcePosition === undefined ? undefined : position,
        progress: animation.progress,
      });
    });
  }

  for (const animation of fxAnimations) {
    const animationId = animation.animationId as AnimationId;
    const module = getModule(animationId);
    if (module === undefined) {
      continue;
    }
    const { sourcePosition } = getOverlayProjectileEndpoints(animationId, animation);

    getOverlayPositions(animation).forEach((position, index) => {
      resolved.push({
        key: `fx-${animation.id}-${index}`,
        animationId,
        module,
        position,
        sourcePosition,
        targetPosition: sourcePosition === undefined ? undefined : position,
        progress: animation.progress,
      });
    });
  }

  if (map === null) {
    return resolved;
  }

  for (const [index, presentation] of statusPresentations.entries()) {
    if (presentation.animationId === undefined) {
      continue;
    }

    const animationId = presentation.animationId as AnimationId;
    const module = getModule(animationId);
    if (module === undefined) {
      continue;
    }

    resolved.push({
      key: `status-${animationId}-${index}`,
      animationId,
      module,
      position: map.playerPosition,
      progress: 0,
      loopDurationMs:
        ANIMATION_REF_BY_ID.get(animationId)?.durationMs
        ?? presentation.ring?.pulsePeriodMs
        ?? 1000,
    });
  }

  return resolved;
}



export function getStatusPresentationEntityScale(
  statusPresentations: readonly StatusPresentationView[],
): number {
  return statusPresentations.reduce(
    (scale, presentation) => Math.max(scale, presentation.entityScale ?? 1),
    1,
  );
}



export interface ThreeAnimationOverlayProps {
  map: MapView | null;
  isEnabled: boolean;
  atmosphereEnabled?: boolean;
  vpTilesWidth: number;
  vpTilesHeight: number;
  bumpAnimations?: DungeonRenderState['bumpAnimations'];
  moveAnimations?: DungeonRenderState['moveAnimations'];
  consumableAnimations: DungeonRenderState['consumableAnimations'];
  fxAnimations: DungeonRenderState['fxAnimations'];
  statusPresentations: DungeonRenderState['statusPresentations'];
  combatIndicators: readonly FloatingCombatIndicator[];
  defenderHits?: ReadonlyMap<EntityId, DefenderHitEntry>;
  vpLeft: number;
  vpTop: number;
  cameraOffset: { readonly x: number; readonly y: number };
  style?: React.CSSProperties;
  createRenderer?: CreateRendererFn;
  onInitialized?: (handledAnimationIds: readonly AnimationId[]) => void;
  onOwnershipChange?: (ownership: ThreeOwnershipReport) => void;
}

export function ThreeAnimationOverlay(props: ThreeAnimationOverlayProps): React.ReactElement | null {
  const {
    map,
    isEnabled,
    atmosphereEnabled = false,
    vpTilesWidth,
    vpTilesHeight,
    bumpAnimations = EMPTY_BUMP_ANIMATIONS,
    moveAnimations = EMPTY_MOVE_ANIMATIONS,
    consumableAnimations,
    fxAnimations,
    statusPresentations,
    combatIndicators,
    defenderHits = EMPTY_DEFENDER_HITS,
    vpLeft,
    vpTop,
    cameraOffset,
    style,
    createRenderer: createRendererProp,
    onInitialized,
    onOwnershipChange,
  } = props;

  const resolvedAnimations = useMemo(
    () =>
      resolveHandledModuleAnimations(
        map,
        consumableAnimations,
        fxAnimations,
        statusPresentations,
      ),
    [map, consumableAnimations, fxAnimations, statusPresentations],
  );

  const policy = useMemo(
    () => computeAnimationDispatchPolicy(
      map,
      resolvedAnimations,
      statusPresentations,
      moveAnimations,
      bumpAnimations,
      combatIndicators,
    ),
    [bumpAnimations, combatIndicators, map, moveAnimations, resolvedAnimations, statusPresentations],
  );

  const ownershipReport = useMemo(
    () => ({
      animationIds: policy.threeOwnedAnimationIds,
      entityIds: policy.threeOwnedEntityIds,
      statusPresentation: policy.threeOwnsStatusPresentations,
      combatIndicators: policy.threeOwnsCombatIndicators,
    }),
    [policy],
  );

  const shouldRender = isEnabled && map != null && (
    resolvedAnimations.length > 0
    || policy.threeOwnedEntityIds.length > 0
    || defenderHits.size > 0
    || combatIndicators.length > 0
    || atmosphereEnabled
  );

  const factory = createRendererProp ?? createThreeRenderer;
  const canvasWidth = vpTilesWidth * CELL_SIZE;
  const canvasHeight = vpTilesHeight * CELL_SIZE;

  const rendererRef = useRef<ThreeRendererHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const animationEntriesRef = useRef<Map<string, AnimationEntry>>(new Map());
  const entitySpriteEntriesRef = useRef<Map<EntityId, EntitySpriteEntry>>(new Map());
  const defenderHitEntriesRef = useRef<Map<EntityId, DefenderHitFlashEntry>>(new Map());
  const combatLabelEntriesRef = useRef<Map<string, CombatLabelEntry>>(new Map());
  const vignetteRef = useRef<AtmosphereVignette | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const latestFrameRef = useRef<FrameState>(EMPTY_FRAME_STATE);

  latestFrameRef.current = {
    map,
    moduleAnimations: resolvedAnimations,
    ownedEntityIds: policy.threeOwnedEntityIds,
    statusPresentations,
    statusPresentationOwned: policy.threeOwnsStatusPresentations,
    moveAnimations,
    bumpAnimations,
    defenderHits,
    combatIndicators,
    vpLeft,
    vpTop,
    cameraOffset,
    canvasWidth,
    canvasHeight,
    vpTilesWidth,
    vpTilesHeight,
  };

  useEffect(() => {
    if (!shouldRender || canvasRef.current === null) {
      setRendererReady(false);
      setRendererFailed(false);
      return;
    }

    setRendererFailed(false);

    let handle: ThreeRendererHandle | null = null;
    try {
      handle = factory(canvasRef.current);
    } catch {
      handle = null;
    }

    if (handle === null) {
      setRendererReady(false);
      setRendererFailed(true);
      return;
    }

    rendererRef.current = handle;
    if (atmosphereEnabled) {
      const vignette = createAtmosphereVignette({
        width: latestFrameRef.current.canvasWidth,
        height: latestFrameRef.current.canvasHeight,
      });
      handle.scene.add(vignette.object);
      vignetteRef.current = vignette;
    }
    setRendererReady(true);
    const animationEntries = animationEntriesRef.current;
    const entitySpriteEntries = entitySpriteEntriesRef.current;
    const defenderHitEntries = defenderHitEntriesRef.current;
    const combatLabelEntries = combatLabelEntriesRef.current;

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      for (const entry of animationEntries.values()) {
        entry.module.dispose(entry.instance);
      }
      animationEntries.clear();

      for (const [entityId, entry] of entitySpriteEntries.entries()) {
        disposeEntitySprite(entry.sprite, handle.scene);
        entitySpriteEntries.delete(entityId);
      }

      for (const [entityId, entry] of defenderHitEntries.entries()) {
        disposeDefenderHitFlash(entry.flash, handle.scene);
        defenderHitEntries.delete(entityId);
      }

      for (const entry of combatLabelEntries.values()) {
        disposeCombatLabel(entry.label, handle.scene);
      }
      combatLabelEntries.clear();

      if (vignetteRef.current !== null) {
        handle.scene.remove(vignetteRef.current.object);
        vignetteRef.current.dispose();
        vignetteRef.current = null;
      }

      handle.dispose();
      rendererRef.current = null;
      setRendererReady(false);
    };
  }, [atmosphereEnabled, factory, shouldRender]);

  useEffect(() => {
    if (!rendererReady || rendererRef.current === null) {
      return;
    }

    const handle = rendererRef.current;
    handle.setSize(canvasWidth, canvasHeight);
    handle.camera.left = 0;
    handle.camera.right = canvasWidth;
    handle.camera.top = canvasHeight;
    handle.camera.bottom = 0;
    handle.camera.updateProjectionMatrix();
    vignetteRef.current?.setSize(canvasWidth, canvasHeight);
  }, [canvasWidth, canvasHeight, rendererReady]);

  useEffect(() => {
    if (onInitialized === undefined) {
      return;
    }

    if (!shouldRender || rendererFailed || !rendererReady) {
      onInitialized([]);
      return;
    }

    onInitialized(policy.threeOwnedAnimationIds);
  }, [policy, onInitialized, rendererFailed, rendererReady, shouldRender]);

  useEffect(() => {
    if (onOwnershipChange === undefined) {
      return;
    }

    if (!shouldRender || rendererFailed || !rendererReady) {
      onOwnershipChange(EMPTY_OWNERSHIP_REPORT);
      return;
    }

    onOwnershipChange(ownershipReport);
  }, [onOwnershipChange, ownershipReport, rendererFailed, rendererReady, shouldRender]);

  useEffect(() => {
    if (!rendererReady || rendererFailed) {
      return;
    }

    const renderFrame = () => {
      const handle = rendererRef.current;
      if (handle === null) {
        return;
      }

      const {
        ownedEntityIds: activeOwnedEntityIds,
        statusPresentations: activeStatusPresentations,
        statusPresentationOwned: activeStatusPresentationOwned,
        moveAnimations: activeMoveAnimations,
        bumpAnimations: activeBumpAnimations,
        defenderHits: activeDefenderHits,
        moduleAnimations,
        combatIndicators: activeCombatIndicators,
        vpLeft: currentVpLeft,
        vpTop: currentVpTop,
        cameraOffset: currentCameraOffset,
        canvasHeight: currentCanvasHeight,
        vpTilesWidth: currentVpTilesWidth,
        vpTilesHeight: currentVpTilesHeight,
      } = latestFrameRef.current;
      const now = Date.now();
      const frameMoveAnimations = activeMoveAnimations.map((animation) =>
        resolveMoveAnimationProgress(animation, now),
      );
      const currentMap = latestFrameRef.current.map;
      const frameCameraOffset = currentMap === null || frameMoveAnimations.length === 0
        ? currentCameraOffset
        : getCameraOffsetForPlayerMove(
            currentMap,
            currentVpTilesWidth,
            currentVpTilesHeight,
            findActivePlayerMove(currentMap, frameMoveAnimations),
          );

      const activeAnimationKeys = new Set<string>();
      for (const animation of moduleAnimations) {
        const progress = animation.loopDurationMs === undefined
          ? animation.progress
          : (now % animation.loopDurationMs) / animation.loopDurationMs;

        if (animation.loopDurationMs === undefined && progress >= 1) {
          const existing = animationEntriesRef.current.get(animation.key);
          if (existing !== undefined) {
            existing.module.dispose(existing.instance);
            animationEntriesRef.current.delete(animation.key);
          }
          continue;
        }

        activeAnimationKeys.add(animation.key);

        let entry = animationEntriesRef.current.get(animation.key);
        if (entry === undefined) {
          entry = {
            instance: animation.module.create({
              renderer: handle,
              scene: handle.scene,
              camera: handle.camera,
              canvasWidth,
              canvasHeight: currentCanvasHeight,
              vpLeft: currentVpLeft,
              vpTop: currentVpTop,
              tileSize: CELL_SIZE,
            }),
            module: animation.module,
          };
          animationEntriesRef.current.set(animation.key, entry);
        }

        const source = animation.sourcePosition === undefined
          ? undefined
          : {
              x: (animation.sourcePosition.x - currentVpLeft) * CELL_SIZE + CELL_SIZE / 2 + frameCameraOffset.x,
              y: currentCanvasHeight - ((animation.sourcePosition.y - currentVpTop) * CELL_SIZE + CELL_SIZE / 2 + frameCameraOffset.y),
            };
        const target = animation.targetPosition === undefined
          ? undefined
          : {
              x: (animation.targetPosition.x - currentVpLeft) * CELL_SIZE + CELL_SIZE / 2 + frameCameraOffset.x,
              y: currentCanvasHeight - ((animation.targetPosition.y - currentVpTop) * CELL_SIZE + CELL_SIZE / 2 + frameCameraOffset.y),
            };
        entry.module.setPosition(entry.instance, {
          x: (animation.position.x - currentVpLeft) * CELL_SIZE + CELL_SIZE / 2 + frameCameraOffset.x,
          y: currentCanvasHeight - ((animation.position.y - currentVpTop) * CELL_SIZE + CELL_SIZE / 2 + frameCameraOffset.y),
          z: 0,
          source,
          target,
        });
        entry.module.update(entry.instance, progress);
      }

      for (const [key, entry] of animationEntriesRef.current.entries()) {
        if (!activeAnimationKeys.has(key)) {
          entry.module.dispose(entry.instance);
          animationEntriesRef.current.delete(key);
        }
      }

      const entityById = new Map((currentMap?.entities ?? []).map((entity) => [entity.id as EntityId, entity]));
      const moveById = new Map(frameMoveAnimations.map((move) => [move.entityId as EntityId, move]));
      const bumpById = new Map(activeBumpAnimations.map((bump) => [bump.attackerId as EntityId, bump]));
      const activeEntityIds = new Set<EntityId>();
      const entityScreenPositions = new Map<EntityId, { x: number; y: number }>();
      const statusEntityScale = activeStatusPresentationOwned
        ? getStatusPresentationEntityScale(activeStatusPresentations)
        : 1;

      for (const entityId of activeOwnedEntityIds) {
        const entity = entityById.get(entityId);
        if (entity === undefined) {
          continue;
        }

        activeEntityIds.add(entityId);

        let entry = entitySpriteEntriesRef.current.get(entityId);
        if (entry === undefined) {
          const sprite = createEntitySprite({
            renderer: handle,
            scene: handle.scene,
            camera: handle.camera,
            canvasWidth,
            canvasHeight: currentCanvasHeight,
            vpLeft: currentVpLeft,
            vpTop: currentVpTop,
            tileSize: CELL_SIZE,
          });
          applyEntitySpriteAppearance(sprite, entity, CELL_SIZE);
          entry = { sprite };
          entitySpriteEntriesRef.current.set(entityId, entry);
        }

        const baseWorld = tileCenterWorld(entity.x, entity.y, CELL_SIZE);
        const baseScreen = worldToScreen(
          baseWorld.x,
          baseWorld.y,
          currentVpLeft,
          currentVpTop,
          CELL_SIZE,
          frameCameraOffset,
        );
        let screenX = baseScreen.x;
        let screenY = baseScreen.y;
        let scaleX = 1;
        let scaleY = 1;

        const move = moveById.get(entityId);
        if (move !== undefined) {
          const offset = getMoveRenderedOffsetPx(move, CELL_SIZE, entity.id);
          const squashStretch = getSquashStretchScale(move.style, move.progress, move.walkPhase);
          screenX += offset.x;
          screenY += offset.y;
          scaleX *= squashStretch.scaleX;
          scaleY *= squashStretch.scaleY;
        }

        const bump = bumpById.get(entityId);
        if (bump !== undefined) {
          const bumpScreen = computeBumpScreenPosition(
            {
              attackerPos: bump.attackerPos,
              defenderPos: bump.defenderPos,
              progress: bump.progress,
              impactFraction: bump.impactFrameMs / bump.durationMs,
            },
            CELL_SIZE,
            currentVpLeft,
            currentVpTop,
            frameCameraOffset,
          );
          const attackerWorld = tileCenterWorld(bump.attackerPos.x, bump.attackerPos.y, CELL_SIZE);
          const attackerBaseScreen = worldToScreen(
            attackerWorld.x,
            attackerWorld.y,
            currentVpLeft,
            currentVpTop,
            CELL_SIZE,
            frameCameraOffset,
          );
          screenX += bumpScreen.x - attackerBaseScreen.x;
          screenY += bumpScreen.y - attackerBaseScreen.y;
        }

        if (entity.type === 'player') {
          scaleX *= statusEntityScale;
          scaleY *= statusEntityScale;
        }

        setEntitySpriteScale(entry.sprite, { x: scaleX, y: scaleY });
        setEntitySpritePosition(entry.sprite, { x: screenX, y: screenY, z: 2 }, currentCanvasHeight);
        entityScreenPositions.set(entityId, { x: screenX, y: screenY });
      }

      for (const [entityId, entry] of entitySpriteEntriesRef.current.entries()) {
        if (!activeEntityIds.has(entityId)) {
          disposeEntitySprite(entry.sprite, handle.scene);
          entitySpriteEntriesRef.current.delete(entityId);
        }
      }

      const activeDefenderHitIds = new Set<EntityId>();
      for (const [entityId, hit] of activeDefenderHits.entries()) {
        const entity = entityById.get(entityId);

        const progress = Math.min((now - hit.startTime) / hit.durationMs, 1);
        if (progress >= 1) {
          const existing = defenderHitEntriesRef.current.get(entityId);
          if (existing !== undefined) {
            disposeDefenderHitFlash(existing.flash, handle.scene);
            defenderHitEntriesRef.current.delete(entityId);
          }
          continue;
        }

        const liveScreenPosition = entity === undefined ? undefined : (entityScreenPositions.get(entityId) ?? (() => {
          const world = tileCenterWorld(entity.x, entity.y, CELL_SIZE);
          return worldToScreen(
            world.x,
            world.y,
            currentVpLeft,
            currentVpTop,
            CELL_SIZE,
            frameCameraOffset,
          );
        })());
        const snapshotScreenPosition = hit.position === undefined ? undefined : (() => {
          const world = tileCenterWorld(hit.position.x, hit.position.y, CELL_SIZE);
          return worldToScreen(
            world.x,
            world.y,
            currentVpLeft,
            currentVpTop,
            CELL_SIZE,
            frameCameraOffset,
          );
        })();
        const screenPosition = liveScreenPosition ?? snapshotScreenPosition;
        if (screenPosition === undefined) {
          continue;
        }

        activeDefenderHitIds.add(entityId);

        let entry = defenderHitEntriesRef.current.get(entityId);
        if (entry === undefined) {
          entry = {
            flash: createDefenderHitFlash({
              renderer: handle,
              scene: handle.scene,
              camera: handle.camera,
              canvasWidth,
              canvasHeight: currentCanvasHeight,
              vpLeft: currentVpLeft,
              vpTop: currentVpTop,
              tileSize: CELL_SIZE,
            }),
          };
          defenderHitEntriesRef.current.set(entityId, entry);
        }

        setDefenderHitFlashPosition(
          entry.flash,
          { x: screenPosition.x, y: screenPosition.y, z: 3 },
          currentCanvasHeight,
        );
        updateDefenderHitFlash(entry.flash, progress);
      }

      for (const [entityId, entry] of defenderHitEntriesRef.current.entries()) {
        if (!activeDefenderHitIds.has(entityId)) {
          disposeDefenderHitFlash(entry.flash, handle.scene);
          defenderHitEntriesRef.current.delete(entityId);
        }
      }

      const activeLabelKeys = new Set<string>();
      activeCombatIndicators.forEach((indicator, index) => {
        const progress = Math.min((now - indicator.startTime) / COMBAT_INDICATOR_FADEOUT_MS, 1);
        if (progress >= 1) {
          return;
        }

        activeLabelKeys.add(indicator.id);

        let entry = combatLabelEntriesRef.current.get(indicator.id);
        if (entry === undefined) {
          entry = {
            label: createCombatLabel(
              {
                renderer: handle,
                scene: handle.scene,
                camera: handle.camera,
                canvasWidth,
                canvasHeight: currentCanvasHeight,
                vpLeft: currentVpLeft,
                vpTop: currentVpTop,
                tileSize: CELL_SIZE,
              },
              indicator.text,
              COMBAT_LABEL_COLORS[indicator.type],
            ),
          };
          combatLabelEntriesRef.current.set(indicator.id, entry);
        }

        const stackIndex = activeCombatIndicators
          .slice(0, index)
          .filter((candidate) => candidate.x === indicator.x && candidate.y === indicator.y)
          .length;
        const stackOffset = stackIndex * 14;

        setCombatLabelPosition(
          entry.label,
          {
            x: (indicator.x - currentVpLeft) * CELL_SIZE + CELL_SIZE + frameCameraOffset.x,
            y: (indicator.y - currentVpTop) * CELL_SIZE + stackOffset - progress * 15 + frameCameraOffset.y,
            z: 4,
          },
          currentCanvasHeight,
        );
        setCombatLabelOpacity(entry.label, Math.max(0, 1 - progress));
      });

      for (const [key, entry] of combatLabelEntriesRef.current.entries()) {
        if (!activeLabelKeys.has(key)) {
          disposeCombatLabel(entry.label, handle.scene);
          combatLabelEntriesRef.current.delete(key);
        }
      }

      handle.render(handle.scene, handle.camera);
      rafIdRef.current = requestAnimationFrame(renderFrame);
    };

    rafIdRef.current = requestAnimationFrame(renderFrame);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [canvasHeight, canvasWidth, rendererFailed, rendererReady]);

  if (!shouldRender || rendererFailed) {
    return null;
  }

  return (
    <canvas
      data-testid="three-animation-overlay"
      ref={canvasRef}
      style={{
        pointerEvents: 'none',
        position: 'absolute',
        top: 0,
        left: 0,
        width: canvasWidth,
        height: canvasHeight,
        ...style,
      }}
    />
  );
}
