import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { AnimationId } from '@dungeon/content';
import type { MapView, StatusPresentationView } from '@dungeon/presenter';
import { spriteRegistry } from '../sprites/sprite-registry.js';
import { renderMap } from '../sprites/canvas-renderer.js';
import { findPath } from '../utils/pathfinding.js';
import { useGameStore } from '../store/game-store.js';
import { initializeAnimationModules } from '../animations/generated/index.js';
import { CELL_SIZE } from '../config/ui-config.js';
import {
  findActivePlayerMove,
  getCameraOffsetForPlayerMove,
  type DungeonRenderState,
} from '../hooks/useDungeonRenderState.js';
import { resolveMoveAnimationProgress } from '../hooks/useMoveAnimationState.js';

interface Props {
  map: MapView;
  vpTilesWidth: number;
  vpTilesHeight: number;
  bumpAnimations: DungeonRenderState['bumpAnimations'];
  moveAnimations: DungeonRenderState['moveAnimations'];
  consumableAnimations: DungeonRenderState['consumableAnimations'];
  fxAnimations: DungeonRenderState['fxAnimations'];
  statusPresentations: readonly StatusPresentationView[];
  vpLeft: number;
  vpTop: number;
  cameraOffset: { readonly x: number; readonly y: number };
  /** Animation IDs to skip rendering (handled by Three overlay) */
  skipHandledAnimationIds?: readonly AnimationId[];
}

export function DungeonCanvas({
  map,
  vpTilesWidth,
  vpTilesHeight,
  bumpAnimations,
  moveAnimations,
  consumableAnimations,
  fxAnimations,
  statusPresentations,
  vpLeft,
  vpTop,
  cameraOffset,
  skipHandledAnimationIds = [],
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());

  const vpRef = useRef({ left: vpLeft, top: vpTop });
  vpRef.current = { left: vpLeft, top: vpTop };
  const cameraOffsetRef = useRef(cameraOffset);
  const didDrawRef = useRef(false);
  const hasFrameAnimations =
    bumpAnimations.length > 0
    || moveAnimations.length > 0
    || consumableAnimations.length > 0
    || fxAnimations.length > 0
    || statusPresentations.length > 0;
  const hasFrameAnimationsRef = useRef(hasFrameAnimations);
  const drawFrameRef = useRef<() => void>(() => {});
  hasFrameAnimationsRef.current = hasFrameAnimations;

  useEffect(() => {
    spriteRegistry.onReady(() => setSpritesReady(true));
    if (!spriteRegistry.isReady()) {
      spriteRegistry.load().catch(() => {});
    }
  }, []);

  // Initialize animation modules on mount
  useEffect(() => {
    initializeAnimationModules();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio;
    const cssWidth  = vpTilesWidth  * CELL_SIZE;
    const cssHeight = vpTilesHeight * CELL_SIZE;
    const pixelWidth = Math.round(cssWidth * dpr);
    const pixelHeight = Math.round(cssHeight * dpr);

    if (canvas.width !== pixelWidth) {
      canvas.width = pixelWidth;
    }
    if (canvas.height !== pixelHeight) {
      canvas.height = pixelHeight;
    }
    if (canvas.style.width !== `${cssWidth}px`) {
      canvas.style.width = `${cssWidth}px`;
    }
    if (canvas.style.height !== `${cssHeight}px`) {
      canvas.style.height = `${cssHeight}px`;
    }
  }, [vpTilesWidth, vpTilesHeight]);

  useEffect(() => {
    cameraOffsetRef.current = cameraOffset;
    if (!didDrawRef.current || hasFrameAnimationsRef.current) {
      return;
    }
    drawFrameRef.current();
  }, [cameraOffset]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let rafId: number | undefined;
    let cancelled = false;

    drawFrameRef.current = () => {
      if (cancelled) return;

      const dpr = window.devicePixelRatio;
      const ctx = canvas.getContext('2d')!;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const now = Date.now();
      const frameMoveAnimations = moveAnimations.map((animation) =>
        resolveMoveAnimationProgress(animation, now),
      );
      const frameCameraOffset = frameMoveAnimations.length === 0
        ? cameraOffsetRef.current
        : getCameraOffsetForPlayerMove(
            map,
            vpTilesWidth,
            vpTilesHeight,
            findActivePlayerMove(map, frameMoveAnimations),
          );

      renderMap(
        ctx,
        map,
        vpRef.current.left,
        vpRef.current.top,
        vpTilesWidth,
        vpTilesHeight,
        bumpAnimations,
        frameMoveAnimations,
        consumableAnimations,
        fxAnimations,
        { statusPresentations },
        frameCameraOffset,
        skipHandledAnimationIds,
      );
      didDrawRef.current = true;
    };

    const draw = () => {
      if (cancelled) return;
      drawFrameRef.current();
      if (hasFrameAnimations) {
        rafId = requestAnimationFrame(draw);
      }
    };

    draw();

    return () => {
      cancelled = true;
      if (rafId !== undefined) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [map, spritesReady, vpTilesWidth, vpTilesHeight, vpLeft, vpTop, bumpAnimations, moveAnimations, consumableAnimations, fxAnimations, statusPresentations, hasFrameAnimations, skipHandledAnimationIds]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const renderedTileW = rect.width  / vpTilesWidth;
    const renderedTileH = rect.height / vpTilesHeight;

    const tileX = Math.floor(((e.clientX - rect.left) - cameraOffset.x) / renderedTileW);
    const tileY = Math.floor(((e.clientY - rect.top) - cameraOffset.y) / renderedTileH);

    if (tileX < 0 || tileX >= vpTilesWidth || tileY < 0 || tileY >= vpTilesHeight) return;

    const grid = {
      x: tileX + vpRef.current.left,
      y: tileY + vpRef.current.top,
    };

    const cell = map.cells.find(c => c.x === grid.x && c.y === grid.y);
    if (cell === undefined || cell.visibility === 'hidden' || !cell.walkable) return;

    // Handle tile-target mode
    const store = useGameStore.getState();
    const selectedAbilityId = store.tileTargetMode.selectedAbilityId;
    if (store.tileTargetMode.active && selectedAbilityId) {
      // Tile-target mode is only entered for tile-target abilities (AbilityView.tileTarget),
      // which never target the player's own tile or an occupied tile.
      const isPlayerTile = grid.x === map.playerPosition.x && grid.y === map.playerPosition.y;
      const isInvalidTileTarget = isPlayerTile
        || cell.visibility !== 'visible'
        || map.entities.some(e => e.x === grid.x && e.y === grid.y);
      if (isInvalidTileTarget) return;

      store.sendCommand({
        type: 'USE_ABILITY',
        abilityId: selectedAbilityId,
        targetPosition: grid,
      });
      store.cancelTileTargeting();
      return;
    }

    // Normal auto-walk mode
    const path = findPath(map, map.playerPosition, grid);
    if (path.length === 0) return;

    const { startAutoWalk } = store;
    startAutoWalk(path);
  }, [map, vpTilesWidth, vpTilesHeight, cameraOffset]);

  return (
    <canvas
      data-testid="dungeon-canvas"
      ref={canvasRef}
      onClick={handleClick}
      style={{ display: 'block', imageRendering: 'pixelated', cursor: 'pointer' }}
    />
  );
}
