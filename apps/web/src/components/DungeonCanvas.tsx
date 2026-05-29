import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MapView, StatusPresentationView } from '@dungeon/presenter';
import { spriteRegistry } from '../sprites/sprite-registry.js';
import { renderMap } from '../sprites/canvas-renderer.js';
import { findPath } from '../utils/pathfinding.js';
import { useGameStore } from '../store/game-store.js';
import { initializeAnimationModules } from '../animations/generated/index.js';
import { CELL_SIZE } from '../config/ui-config.js';
import type { DungeonRenderState } from '../hooks/useDungeonRenderState.js';

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
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());

  const vpRef = useRef({ left: vpLeft, top: vpTop });
  vpRef.current = { left: vpLeft, top: vpTop };

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

    canvas.width  = cssWidth  * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width  = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;

    renderMap(
      ctx,
      map,
      vpRef.current.left,
      vpRef.current.top,
      vpTilesWidth,
      vpTilesHeight,
      bumpAnimations,
      moveAnimations,
      consumableAnimations,
      fxAnimations,
      { statusPresentations },
      cameraOffset,
    );
  }, [map, spritesReady, vpTilesWidth, vpTilesHeight, vpLeft, vpTop, bumpAnimations, moveAnimations, consumableAnimations, fxAnimations, statusPresentations, cameraOffset]);

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
    if (cell !== undefined && !cell.walkable) return;

    const path = findPath(map, map.playerPosition, grid);
    if (path.length === 0) return;

    const { startAutoWalk } = useGameStore.getState();
    startAutoWalk(path);
  }, [map, vpTilesWidth, vpTilesHeight, cameraOffset]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ display: 'block', imageRendering: 'pixelated', cursor: 'pointer' }}
    />
  );
}
