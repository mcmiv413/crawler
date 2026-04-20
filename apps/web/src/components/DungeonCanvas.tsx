import React, { useRef, useEffect, useState, useCallback } from 'react';
import type { MapView } from '@dungeon/presenter';
import { spriteRegistry } from '../sprites/sprite-registry.js';
import { renderMap } from '../sprites/canvas-renderer.js';
import { screenToGrid } from '../utils/screen-to-grid.js';
import { findPath } from '../utils/pathfinding.js';
import { useGameStore } from '../store/game-store.js';
import { useBumpAnimationState } from '../hooks/useBumpAnimationState.js';
import { BUMP_ANIMATION_DURATION_MS } from '../config/ui-config.js';
import { VP_WIDTH, VP_HEIGHT } from '../utils/viewport.js';

interface Props {
  map: MapView;
  vpTilesWidth?: number;
  vpTilesHeight?: number;
}

export function DungeonCanvas({ map, vpTilesWidth, vpTilesHeight }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spritesReady, setSpritesReady] = useState(spriteRegistry.isReady());
  const vpRef = useRef({ left: 0, top: 0 });
  const { animations: bumpAnimations } = useBumpAnimationState(BUMP_ANIMATION_DURATION_MS);

  // Use provided dimensions or fall back to constants
  const vp_width = vpTilesWidth || VP_WIDTH;
  const vp_height = vpTilesHeight || VP_HEIGHT;
  const cellSize = 24; // Fixed tile size

  useEffect(() => {
    spriteRegistry.onReady(() => setSpritesReady(true));
    if (!spriteRegistry.isReady()) {
      spriteRegistry.load().catch(() => {
        // Silently fail - sprites are optional, ASCII fallback available
      });
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio;
    const cssWidth = vp_width * cellSize;
    const cssHeight = vp_height * cellSize;

    canvas.width = cssWidth * dpr;
    canvas.height = cssHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(dpr, dpr);
    // Disable image smoothing to keep pixels sharp
    ctx.imageSmoothingEnabled = false;

    // Viewport centered on player
    const minX = Math.min(...map.cells.map(c => c.x));
    const minY = Math.min(...map.cells.map(c => c.y));
    const vpLeft = Math.max(minX, map.playerPosition.x - Math.floor(vp_width / 2));
    const vpTop = Math.max(minY, map.playerPosition.y - Math.floor(vp_height / 2));

    vpRef.current = { left: vpLeft, top: vpTop };

    renderMap(ctx, map, vpLeft, vpTop, vp_width, vp_height, bumpAnimations);
  }, [map, spritesReady, vp_width, vp_height, bumpAnimations]);

  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = (vp_width * cellSize) / rect.width;
    const scaleY = (vp_height * cellSize) / rect.height;
    const offsetX = (e.clientX - rect.left) * scaleX;
    const offsetY = (e.clientY - rect.top) * scaleY;

    const grid = screenToGrid(offsetX, offsetY, vpRef.current.left, vpRef.current.top, cellSize);

    // Validate target cell is visible/remembered and walkable
    const cell = map.cells.find(c => c.x === grid.x && c.y === grid.y);
    if (!cell || cell.visibility === 'hidden' || !cell.walkable) return;

    // Check if target has an enemy — if so, path to adjacent cell
    const enemyAtTarget = map.entities.find(
      e => e.type === 'enemy' && e.x === grid.x && e.y === grid.y,
    );

    let target = grid;
    if (enemyAtTarget) {
      // Find the nearest adjacent walkable cell to the enemy
      target = grid; // Path to the enemy cell — bump-to-attack will handle it
    }

    const path = findPath(map, map.playerPosition, target);
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
