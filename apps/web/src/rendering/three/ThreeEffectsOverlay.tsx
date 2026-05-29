import React, { useEffect, useRef, useState } from 'react';
import type { MapView, ConsumableAnimationEntry, AbilityAnimationEntry, StatusPresentationView } from '@dungeon/presenter';
import { CELL_SIZE } from '../../config/ui-config.js';
import { createThreeRenderer } from './three-renderer-factory.js';
import { get as getEffectModule } from './three-effect-registry.js';
import { tileCenterWorld, worldToScreen } from './three-coordinate-utils.js';
// Import built-in effects to register them
import './effects/index.js';

type CreateRendererFn = typeof createThreeRenderer;

export interface ThreeEffectsOverlayProps {
  map: MapView | null;
  isEnabled: boolean;
  vpTilesWidth: number;
  vpTilesHeight: number;
  bumpAnimations?: readonly unknown[];
  moveAnimations?: readonly unknown[];
  consumableAnimations: readonly ConsumableAnimationEntry[];
  fxAnimations: readonly AbilityAnimationEntry[];
  statusPresentations: readonly StatusPresentationView[];
  vpLeft: number;
  vpTop: number;
  cameraOffset: { readonly x: number; readonly y: number };
  style?: React.CSSProperties;
  /** Test seam: override the renderer factory to avoid real WebGL. */
  createRenderer?: CreateRendererFn;
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
  } = props;

  // Check if any animation has a registered Three.js handler
  const hasHandledAnimation = [
    ...consumableAnimations,
    ...fxAnimations,
  ].some((anim) => {
    const animationId = (anim as any).animationId;
    return animationId && getEffectModule(animationId) !== undefined;
  });

  const shouldRender = isEnabled && map != null && hasHandledAnimation;

  const rendererRef = useRef<ReturnType<CreateRendererFn>>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendererReady, setRendererReady] = useState(false);
  const effectInstancesRef = useRef<Map<string, { startTime: number; instance: any; animationId: string; playerPos: { x: number; y: number } }>>(new Map());
  const animationFrameIdRef = useRef<number | null>(null);
  const activeKeysRef = useRef<Set<string>>(new Set());

  const factory = createRendererProp ?? createThreeRenderer;

  const canvasWidth = vpTilesWidth * CELL_SIZE;
  const canvasHeight = vpTilesHeight * CELL_SIZE;

  // Initialize renderer when canvas is mounted
  useEffect(() => {
    if (!shouldRender || !canvasRef.current) {
      setRendererReady(false);
      return;
    }

    let handle: ReturnType<CreateRendererFn> | null = null;
    try {
      handle = factory(canvasRef.current);
    } catch {
      handle = null;
    }

    if (!handle) {
      setRendererReady(false);
      return;
    }

    rendererRef.current = handle;
    handle.setSize(canvasWidth, canvasHeight);

    // Configure camera to match viewport
    // Orthographic camera: left, right, top, bottom, near, far
    // Map screen pixels (0,0) at top-left to (canvasWidth, canvasHeight) at bottom-right
    const camera = handle.camera as any;
    if (camera) {
      camera.left = 0;
      camera.right = canvasWidth;
      camera.top = 0;
      camera.bottom = canvasHeight;
      if (typeof camera.updateProjectionMatrix === 'function') {
        camera.updateProjectionMatrix();
      }
    }

    setRendererReady(true);

    const effectInstances = effectInstancesRef.current;
    const activeKeys = activeKeysRef.current;

    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      // Clean up all effect instances
      effectInstances.forEach(({ instance, animationId }) => {
        const module = getEffectModule(animationId);
        if (module) {
          module.dispose(instance);
        }
      });
      effectInstances.clear();
      activeKeys.clear();

      handle.dispose();
      rendererRef.current = null;
      setRendererReady(false);
    };
  }, [shouldRender, canvasWidth, canvasHeight, factory]);

  // Animation frame loop
  useEffect(() => {
    if (!rendererRef.current) {
      return;
    }

    const allAnimations = [
      ...consumableAnimations.map((a, idx) => ({ ...a, type: 'consumable' as const, index: idx })),
      ...fxAnimations.map((a, idx) => ({ ...a, type: 'ability' as const, index: idx })),
    ];

    const renderFrame = () => {
      const handle = rendererRef.current;
      if (!handle) return;

      const now = performance.now();
      const newActiveKeys = new Set<string>();
      const effectsToRemove: string[] = [];

      allAnimations.forEach((anim) => {
        const animationId = anim.animationId;
        if (!animationId) return;

        const module = getEffectModule(animationId);
        if (!module) return; // No Three.js handler for this animation

        const key = `${anim.type}:${anim.index}`;
        newActiveKeys.add(key);

        let effectEntry = effectInstancesRef.current.get(key);
        if (!effectEntry) {
          // First frame: create the effect
          const context = {
            renderer: handle,
            scene: handle.scene,
            camera: handle.camera,
            canvasWidth,
            canvasHeight,
            vpLeft,
            vpTop,
            tileSize: CELL_SIZE,
          };
          const instance = module.create(context);
          const playerPos = anim.playerPos;
          effectInstancesRef.current.set(key, { startTime: now, instance, animationId, playerPos });
          effectEntry = { startTime: now, instance, animationId, playerPos };

          // Position effect at player's location
          // Convert player's tile position to world center, then to screen space
          const worldPos = tileCenterWorld(playerPos.x, playerPos.y, CELL_SIZE);
          const screenPos = worldToScreen(
            worldPos.x,
            worldPos.y,
            vpLeft,
            vpTop,
            CELL_SIZE,
            cameraOffset,
          );

          // Update group position (Three.js y+ = up, but we're using screen coords with y+ = down)
          // Since we're in screen-space coords, just set position directly
          const group = (instance as any).group;
          if (group) {
            group.position.x = screenPos.x;
            group.position.y = screenPos.y;
            group.position.z = 0;
          }
        }

        // Calculate progress (0 to 1)
        const elapsed = now - effectEntry.startTime;
        const progress = Math.min(elapsed / anim.durationMs, 1);

        if (progress >= 1) {
          // Animation complete
          module.dispose(effectEntry.instance);
          effectsToRemove.push(key);
        } else {
          // Update the effect
          module.update(effectEntry.instance, progress);
        }
      });

      // Remove effects that are no longer active
      activeKeysRef.current.forEach(key => {
        if (!newActiveKeys.has(key)) {
          const effectEntry = effectInstancesRef.current.get(key);
          if (effectEntry) {
            const module = getEffectModule(effectEntry.animationId);
            if (module) {
              module.dispose(effectEntry.instance);
            }
            effectsToRemove.push(key);
          }
        }
      });

      // Remove completed/disposed effects
      effectsToRemove.forEach(key => effectInstancesRef.current.delete(key));
      activeKeysRef.current = newActiveKeys;

      // Render the scene
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
  }, [rendererRef, consumableAnimations, fxAnimations, vpLeft, vpTop, cameraOffset, canvasWidth, canvasHeight]);

  if (!shouldRender) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      width={canvasWidth}
      height={canvasHeight}
      style={{
        position: 'absolute',
        pointerEvents: 'none',
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        ...style,
      }}
    />
  );
}
