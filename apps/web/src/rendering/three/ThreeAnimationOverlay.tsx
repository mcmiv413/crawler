/**
 * ThreeAnimationOverlay — generalized Three.js WebGL animation canvas.
 *
 * Replaces ThreeEffectsOverlay as the primary animation overlay component.
 * Uses three-animation-registry (ThreeAnimationModule with id + category)
 * instead of the narrower three-effect-registry.
 *
 * ThreeEffectsOverlay remains as a compatibility re-export from this module.
 *
 * Ownership model
 * ---------------
 * The overlay resolves active consumable and fx animations against the
 * three-animation-registry. Only animations that have a registered module
 * are rendered here; unregistered animations remain on the canvas path.
 *
 * The component calls onInitialized(handledIds) after WebGL succeeds, and
 * onInitialized([]) on failure or when no handled animations are active.
 * DungeonPhase uses this callback to suppress canvas rendering of owned IDs.
 *
 * Y-axis flip
 * -----------
 * The game world uses y+ = down (canvas convention).
 * Three.js uses y+ = up. This component flips y once when computing
 * setPosition: posY = canvasHeight - screenY.
 * Module implementations must NOT flip y themselves.
 *
 * Pointer safety
 * --------------
 * The canvas has pointer-events:none so it never intercepts dungeon clicks.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AnimationId } from '@dungeon/content';
import type { MapView } from '@dungeon/presenter';
import { CELL_SIZE } from '../../config/ui-config.js';
import type { DungeonRenderState } from '../../hooks/useDungeonRenderState.js';
import { createThreeRenderer } from './three-renderer-factory.js';
import type { ThreeRendererHandle } from './three-renderer-factory.js';
import { getAnimationModule } from './three-animation-registry.js';
import type { ThreeAnimationModule } from './three-animation-types.js';
import { tileCenterWorld, worldToScreen } from './three-coordinate-utils.js';

type CreateRendererFn = (canvas: HTMLCanvasElement) => ThreeRendererHandle | null;

type OverlayAnimation =
  | DungeonRenderState['consumableAnimations'][number]
  | DungeonRenderState['fxAnimations'][number];

interface AnimationEntry {
  readonly animationId: AnimationId;
  readonly instance: unknown;
  readonly module: ThreeAnimationModule;
}

interface ResolvedAnimation {
  readonly key: string;
  readonly animationId: AnimationId;
  readonly module: ThreeAnimationModule;
  readonly playerPos: OverlayAnimation['playerPos'];
  readonly progress: number;
}

interface FrameState {
  readonly animations: readonly ResolvedAnimation[];
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

export interface ThreeAnimationOverlayProps {
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
  /**
   * Called with the list of AnimationIds now handled by Three after
   * successful initialization, or with [] on failure/no active animations.
   */
  onInitialized?: (handledAnimationIds: readonly AnimationId[]) => void;
}

function resolveHandledAnimations(
  consumableAnimations: DungeonRenderState['consumableAnimations'],
  fxAnimations: DungeonRenderState['fxAnimations'],
): ResolvedAnimation[] {
  const resolved: ResolvedAnimation[] = [];

  for (const anim of consumableAnimations) {
    const module = getAnimationModule((anim as any).animationId);
    if (!module) continue;
    resolved.push({
      key: `consumable-${(anim as any).id ?? JSON.stringify(anim)}`,
      animationId: (anim as any).animationId,
      module,
      playerPos: anim.playerPos,
      progress: (anim as any).progress ?? 0,
    });
  }

  for (const anim of fxAnimations) {
    const module = getAnimationModule((anim as any).animationId);
    if (!module) continue;
    resolved.push({
      key: `fx-${(anim as any).id ?? JSON.stringify(anim)}`,
      animationId: (anim as any).animationId,
      module,
      playerPos: anim.playerPos,
      progress: (anim as any).progress ?? 0,
    });
  }

  return resolved;
}

function getHandledIds(resolved: readonly ResolvedAnimation[]): AnimationId[] {
  const seen = new Set<AnimationId>();
  for (const r of resolved) {
    seen.add(r.animationId);
  }
  return [...seen];
}

/**
 * Generalized Three.js animation overlay.
 *
 * Renders as a pointer-events:none canvas positioned over the dungeon canvas.
 * Only mounts when isEnabled, map is present, and at least one animation has
 * a registered Three module.
 */
export function ThreeAnimationOverlay(props: ThreeAnimationOverlayProps): React.ReactElement | null {
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
    () => resolveHandledAnimations(consumableAnimations, fxAnimations),
    [consumableAnimations, fxAnimations],
  );

  const handledIds = useMemo(() => getHandledIds(resolvedAnimations), [resolvedAnimations]);
  const handledIdsKey = handledIds.join('\0');

  const shouldRender = isEnabled && map != null && handledIds.length > 0;

  const factory = createRendererProp ?? createThreeRenderer;
  const canvasWidth = vpTilesWidth * CELL_SIZE;
  const canvasHeight = vpTilesHeight * CELL_SIZE;

  const rendererRef = useRef<ThreeRendererHandle | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const [rendererFailed, setRendererFailed] = useState(false);
  const animationEntries = useRef<Map<string, AnimationEntry>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const latestFrameRef = useRef<FrameState>(EMPTY_FRAME_STATE);
  const handledIdsRef = useRef<readonly AnimationId[]>(handledIds);

  // Keep latest frame data accessible without re-running rAF loop effects.
  latestFrameRef.current = {
    animations: resolvedAnimations,
    vpLeft,
    vpTop,
    cameraOffset,
    canvasWidth,
    canvasHeight,
  };
  handledIdsRef.current = handledIds;

  // Effect 1: Initialize or tear down the renderer when shouldRender changes.
  useEffect(() => {
    if (!shouldRender || !canvasRef.current) {
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

    if (!handle) {
      setRendererReady(false);
      setRendererFailed(true);
      return;
    }

    rendererRef.current = handle;
    setRendererReady(true);

    const entries = animationEntries.current;

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      entries.forEach((entry) => {
        entry.module.dispose(entry.instance);
      });
      entries.clear();

      handle.dispose();
      rendererRef.current = null;
      setRendererReady(false);
    };
  }, [factory, shouldRender]);

  // Effect 2: Resize the camera/renderer when canvas dimensions change.
  useEffect(() => {
    if (!rendererReady || !rendererRef.current) return;

    const handle = rendererRef.current;
    handle.setSize(canvasWidth, canvasHeight);
    handle.camera.left = 0;
    handle.camera.right = canvasWidth;
    handle.camera.top = canvasHeight;
    handle.camera.bottom = 0;
    handle.camera.updateProjectionMatrix();
  }, [canvasWidth, canvasHeight, rendererReady]);

  // Effect 3: Report ownership to DungeonPhase via onInitialized.
  useEffect(() => {
    if (!onInitialized) return;

    if (!shouldRender || rendererFailed || !rendererReady) {
      onInitialized([]);
      return;
    }

    onInitialized(handledIdsRef.current);
  }, [handledIdsKey, onInitialized, rendererFailed, rendererReady, shouldRender]);

  // Effect 4: Animation frame loop.
  useEffect(() => {
    if (!rendererReady || rendererFailed) return;

    const renderFrame = () => {
      const handle = rendererRef.current;
      if (!handle) return;

      const {
        animations,
        vpLeft: vpl,
        vpTop: vpt,
        cameraOffset: camOff,
        canvasWidth: cw,
        canvasHeight: ch,
      } = latestFrameRef.current;

      const activeKeys = new Set<string>();

      for (const anim of animations) {
        if (anim.progress >= 1) {
          const existing = animationEntries.current.get(anim.key);
          if (existing) {
            existing.module.dispose(existing.instance);
            animationEntries.current.delete(anim.key);
          }
          continue;
        }

        activeKeys.add(anim.key);

        let entry = animationEntries.current.get(anim.key);
        if (!entry) {
          entry = {
            animationId: anim.animationId,
            instance: anim.module.create({
              renderer: handle,
              scene: handle.scene,
              camera: handle.camera,
              canvasWidth: cw,
              canvasHeight: ch,
              vpLeft: vpl,
              vpTop: vpt,
              tileSize: CELL_SIZE,
            }),
            module: anim.module,
          };
          animationEntries.current.set(anim.key, entry);
        }

        const worldPos = tileCenterWorld(anim.playerPos.x, anim.playerPos.y, CELL_SIZE);
        const screenPos = worldToScreen(worldPos.x, worldPos.y, vpl, vpt, CELL_SIZE, camOff);

        // Single y-axis flip point: game y+ = down → Three y+ = up.
        entry.module.setPosition(entry.instance, {
          x: screenPos.x,
          y: ch - screenPos.y,
          z: 0,
        });
        entry.module.update(entry.instance, anim.progress);
      }

      // Dispose stale entries no longer in the active set.
      for (const [key, entry] of animationEntries.current.entries()) {
        if (!activeKeys.has(key)) {
          entry.module.dispose(entry.instance);
          animationEntries.current.delete(key);
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
  }, [rendererFailed, rendererReady]);

  if (!shouldRender) return null;
  if (rendererFailed) return null;

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
