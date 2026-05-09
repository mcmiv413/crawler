import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import type { MapView, StatusPresentationView, StatusView } from '@dungeon/presenter';
import { spriteRegistry } from '../sprites/sprite-registry.js';
import { renderMap } from '../sprites/canvas-renderer.js';
import { findPath } from '../utils/pathfinding.js';
import { useGameStore } from '../store/game-store.js';
import { useBumpAnimationState } from '../hooks/useBumpAnimationState.js';
import { useMoveAnimationState } from '../hooks/useMoveAnimationState.js';
import { useConsumableAnimationState } from '../hooks/useConsumableAnimationState.js';
import { useFxAnimationState } from '../hooks/useFxAnimationState.js';
import { initializeAnimationModules } from '../animations/generated/index.js';
import { BUMP_ANIMATION_DURATION_MS, CELL_SIZE } from '../config/ui-config.js';
import { VP_WIDTH, VP_HEIGHT } from '../config/ui-config.js';

const EMPTY_STATUSES: readonly StatusView[] = [];

interface Props {
  map: MapView;
  vpTilesWidth?: number;
  vpTilesHeight?: number;
}

export function DungeonCanvas({ map, vpTilesWidth, vpTilesHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());
  const { animations: bumpAnimations }       = useBumpAnimationState(BUMP_ANIMATION_DURATION_MS);
  const { animations: moveAnimations }       = useMoveAnimationState();
  const { animations: consumableAnimations } = useConsumableAnimationState();
  const animatedEvents = useGameStore((s) => s.view?.animatedEvents ?? []);
  const { animations: fxAnimations } = useFxAnimationState(animatedEvents);

  const playerStatuses = useGameStore((s) => s.view?.player.statuses ?? EMPTY_STATUSES);
  const statusPresentations: readonly StatusPresentationView[] = useMemo(
    () => playerStatuses
      .map((status) => status.presentation)
      .filter((presentation): presentation is StatusPresentationView => presentation !== undefined),
    [playerStatuses],
  );

  const vp_width  = vpTilesWidth  ?? VP_WIDTH;
  const vp_height = vpTilesHeight ?? VP_HEIGHT;

  const minX = map.cells.length > 0 ? Math.min(...map.cells.map(c => c.x)) : 0;
  const minY = map.cells.length > 0 ? Math.min(...map.cells.map(c => c.y)) : 0;
  const vpLeft = Math.max(minX, map.playerPosition.x - Math.floor(vp_width / 2));
  const vpTop  = Math.max(minY, map.playerPosition.y - Math.floor(vp_height / 2));

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
    const cssWidth  = vp_width  * CELL_SIZE;
    const cssHeight = vp_height * CELL_SIZE;

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
      vp_width,
      vp_height,
      bumpAnimations,
      moveAnimations,
      consumableAnimations,
      fxAnimations,
      { statusPresentations },
    );
  }, [map, spritesReady, vp_width, vp_height, bumpAnimations, moveAnimations, consumableAnimations, fxAnimations, statusPresentations]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const renderedTileW = rect.width  / vp_width;
    const renderedTileH = rect.height / vp_height;

    const tileX = Math.floor((e.clientX - rect.left) / renderedTileW);
    const tileY = Math.floor((e.clientY - rect.top)  / renderedTileH);

    if (tileX < 0 || tileX >= vp_width || tileY < 0 || tileY >= vp_height) return;

    const grid = {
      x: tileX + vpRef.current.left,
      y: tileY + vpRef.current.top,
    };

    const cell = map.cells.find(c => c.x === grid.x && c.y === grid.y);
    if (!cell || !cell.walkable) return;

    const path = findPath(map, map.playerPosition, grid);
    if (path.length === 0) return;

    const { startAutoWalk } = useGameStore.getState();
    startAutoWalk(path);
  }, [map, vp_width, vp_height]);

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{ display: 'block', imageRendering: 'pixelated', cursor: 'pointer' }}
    />
  );
}
