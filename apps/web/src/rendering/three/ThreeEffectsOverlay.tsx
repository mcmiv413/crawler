import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationId } from '@dungeon/content';
import type { MapView } from '@dungeon/presenter';
import { CELL_SIZE } from '../../config/ui-config.js';
import type { DungeonRenderState } from '../../hooks/useDungeonRenderState.js';
import { createThreeRenderer } from './three-renderer-factory.js';
import { get as getEffectModule } from './three-effect-registry.js';
import { tileCenterWorld, worldToScreen } from './three-coordinate-utils.js';
import { isBuiltInThreeEffectId } from '../three-effect-metadata.js';
import type { ThreeEffectModule } from './three-effect-types.js';
import './effects/index.js';

type CreateRendererFn = typeof createThreeRenderer;
type OverlayAnimation =
  | DungeonRenderState['consumableAnimations'][number]
  | DungeonRenderState['fxAnimations'][number];

interface EffectEntry {
  readonly animationId: AnimationId;
  readonly instance: unknown;
  readonly module: ThreeEffectModule;
}

interface ResolvedOverlayAnimation {
  readonly key: string;
  readonly animationId: AnimationId;
  readonly module: ThreeEffectModule;
  readonly playerPos: OverlayAnimation['playerPos'];
  readonly progress: number;
}

interface FrameState {
  readonly animations: readonly ResolvedOverlayAnimation[];
  readonly vpLeft: number;
  readonly vpTop: number;
  readonly cameraOffset: { readonly x: number; readonly y: number };
  readonly canvasWidth: number;
  readonly canvasHeight: number;
}

const EMPTY_FRAME_STATE: FrameState = {
  animations: [],
  vpLeft: 0,
  vpTop: 0,
  cameraOffset: { x: 0, y: 0 },
  canvasWidth: 0,
  canvasHeight: 0,
};

export interface ThreeEffectsOverlayProps {
  map: MapView | null;
  isEnabled: boolean;
  vpTilesWidth: number;
  vpTilesHeight: number;
  bumpAnimations?: DungeonRenderState['bumpAnimations'];
  moveAnimations?: DungeonRenderState['moveAnimations'];
  consumableAnimations: DungeonRenderState['consumableAnimations'];
  fxAnimations: DungeonRenderState['fxAnimations'];
  statusPresentations: DungeonRenderState['statusPresentations'];
  vpLeft: number;
  vpTop: number;
  cameraOffset: { readonly x: number; readonly y: number };
  style?: React.CSSProperties;
  /** Test seam: override the renderer factory to avoid real WebGL. */
  createRenderer?: CreateRendererFn;
  /** Callback to report which animation IDs are handled by the overlay when init succeeds, or empty array on failure */
  onInitialized?: (handledAnimationIds: readonly AnimationId[]) => void;
}

/**
 * Mounts a Three.js WebGL canvas as a pointer-events:none overlay on top of
 * the dungeon canvas.  Renders only when:
 *   - isEnabled is true
 *   - a map is present
 *   - at least one animation (consumable or fx) is active
 *   - WebGL renderer creation succeeded
 *
 * Degrades gracefully to null when WebGL is unavailable.
 */
export function ThreeEffectsOverlay(props: ThreeEffectsOverlayProps): React.ReactElement | null {
  const {
    map,
    isEnabled,
    vpTilesWidth,
    vpTilesHeight,
    consumableAnimations,
    fxAnimations,
    vpLeft,
    vpTop,
    cameraOffset,
    style,
    createRenderer: createRendererProp,
    onInitialized,
  } = props;

  const resolvedAnimations = useMemo(
    () => resolveHandledOverlayAnimations(consumableAnimations, fxAnimations),
    [consumableAnimations, fxAnimations],
  );
  const handledAnimationIds = useMemo(
    () => getHandledAnimationIds(resolvedAnimations),
    [resolvedAnimations],
  );
  const handledAnimationKey = handledAnimationIds.join('\0');
  const shouldRender = isEnabled && map != null && handledAnimationIds.length > 0;
  const rendererRef = useRef<ReturnType<CreateRendererFn>>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const effectInstancesRef = useRef<Map<string, EffectEntry>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);
  const latestFrameStateRef = useRef<FrameState>(EMPTY_FRAME_STATE);
  const handledAnimationIdsRef = useRef<readonly AnimationId[]>(handledAnimationIds);

  const factory = createRendererProp ?? createThreeRenderer;
  const canvasWidth = vpTilesWidth * CELL_SIZE;
  const canvasHeight = vpTilesHeight * CELL_SIZE;

  latestFrameStateRef.current = {
    animations: resolvedAnimations,
    vpLeft,
    vpTop,
    cameraOffset,
    canvasWidth,
    canvasHeight,
  };
  handledAnimationIdsRef.current = handledAnimationIds;

  useEffect(() => {
    if (!shouldRender || !canvasRef.current) {
      setRendererReady(false);
      setRendererFailed(false);
      return;
    }

    setRendererFailed(false);

    let handle: ReturnType<CreateRendererFn> | null = null;
    try {
      handle = factory(canvasRef.current);
    } catch {
      handle = null;
    }

    if (!handle) {
      setRendererReady(false);
      setRendererFailed(true);
      return;
    }

    rendererRef.current = handle;
    setRendererReady(true);

    const effectInstances = effectInstancesRef.current;

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }

      effectInstances.forEach((entry) => {
        entry.module.dispose(entry.instance);
      });
      effectInstances.clear();

      handle.dispose();
      rendererRef.current = null;
      setRendererReady(false);
    };
  }, [factory, shouldRender]);

  useEffect(() => {
    if (!rendererReady || !rendererRef.current) {
      return;
    }

    const handle = rendererRef.current;
    handle.setSize(canvasWidth, canvasHeight);

    handle.camera.left = 0;
    handle.camera.right = canvasWidth;
    handle.camera.top = canvasHeight;
    handle.camera.bottom = 0;
    handle.camera.updateProjectionMatrix();
  }, [canvasHeight, canvasWidth, rendererReady]);

  useEffect(() => {
    if (!onInitialized) {
      return;
    }

    if (!shouldRender || rendererFailed || !rendererReady) {
      onInitialized([]);
      return;
    }

    onInitialized(handledAnimationIdsRef.current);
  }, [handledAnimationKey, onInitialized, rendererFailed, rendererReady, shouldRender]);

  useEffect(() => {
    if (!rendererReady || rendererFailed) {
      return;
    }

    const renderFrame = () => {
      const handle = rendererRef.current;
      if (!handle) {
        return;
      }

      const {
        animations,
        vpLeft,
        vpTop,
        cameraOffset,
        canvasWidth,
        canvasHeight,
      } = latestFrameStateRef.current;
      const activeKeys = new Set<string>();

      for (const animation of animations) {
        if (animation.progress >= 1) {
          const existingEntry = effectInstancesRef.current.get(animation.key);
          if (existingEntry) {
            existingEntry.module.dispose(existingEntry.instance);
            effectInstancesRef.current.delete(animation.key);
          }
          continue;
        }

        activeKeys.add(animation.key);

        let effectEntry = effectInstancesRef.current.get(animation.key);
        if (!effectEntry) {
          effectEntry = {
            animationId: animation.animationId,
            instance: animation.module.create({
              renderer: handle,
              scene: handle.scene,
              camera: handle.camera,
              canvasWidth,
              canvasHeight,
              vpLeft,
              vpTop,
              tileSize: CELL_SIZE,
            }),
            module: animation.module,
          };
          effectInstancesRef.current.set(animation.key, effectEntry);
        }

        const worldPos = tileCenterWorld(animation.playerPos.x, animation.playerPos.y, CELL_SIZE);
        const screenPos = worldToScreen(
          worldPos.x,
          worldPos.y,
          vpLeft,
          vpTop,
          CELL_SIZE,
          cameraOffset,
        );
        effectEntry.module.setPosition(effectEntry.instance, { x: screenPos.x, y: screenPos.y, z: 0 });
        effectEntry.module.update(effectEntry.instance, animation.progress);
      }

      for (const [key, entry] of effectInstancesRef.current.entries()) {
        if (activeKeys.has(key)) {
          continue;
        }

        entry.module.dispose(entry.instance);
        effectInstancesRef.current.delete(key);
      }

      handle.render(handle.scene, handle.camera);
      animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    animationFrameIdRef.current = requestAnimationFrame(renderFrame);

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [rendererFailed, rendererReady]);

  if (!shouldRender) {
    return null;
  }

  if (rendererFailed) {
    return null;
  }

  return (
    <canvas
      data-testid="three-effects-overlay"
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 1,
        pointerEvents: 'none',
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        ...style,
      }}
    />
  );
}

function resolveHandledOverlayAnimations(
  consumableAnimations: DungeonRenderState['consumableAnimations'],
  fxAnimations: DungeonRenderState['fxAnimations'],
): ResolvedOverlayAnimation[] {
  const resolvedAnimations: ResolvedOverlayAnimation[] = [];

  for (const animation of [...consumableAnimations, ...fxAnimations]) {
    if (!isBuiltInThreeEffectId(animation.animationId)) {
      continue;
    }

    const module = getEffectModule(animation.animationId);
    if (!module) {
      continue;
    }

    resolvedAnimations.push({
      key: animation.id,
      animationId: animation.animationId,
      module,
      playerPos: animation.playerPos,
      progress: animation.progress,
    });
  }

  return resolvedAnimations;
}

function getHandledAnimationIds(animations: readonly ResolvedOverlayAnimation[]): AnimationId[] {
  const handledIds = new Set<AnimationId>();

  for (const animation of animations) {
    handledIds.add(animation.animationId);
  }

  return [...handledIds];
}
