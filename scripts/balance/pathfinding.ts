/**
 * pathfinding.ts — BFS-based navigation helpers for dungeon exploration
 */

import type { GameCommand } from '@dungeon/contracts';
import type { GameView } from '@dungeon/presenter';
import { DIRS8, type BfsNode } from './types.js';

/**
 * BFS toward the nearest visible stairs_down tile.
 * Navigates only through known (visible/remembered) walkable cells.
 */
export function pathfindToStairs(view: GameView): GameCommand | null {
  if (!view.map) return null;
  const { cells, playerPosition } = view.map;

  const walkableKnown = new Set<string>();
  let target: { x: number; y: number } | null = null;

  for (const cell of cells) {
    // view.map.cells excludes hidden cells — everything here is visible or remembered
    if (cell.walkable) walkableKnown.add(`${cell.x},${cell.y}`);
    if (cell.tileType === 'stairs_down') target = { x: cell.x, y: cell.y };
  }

  if (!target) return null;

  const startKey = `${playerPosition.x},${playerPosition.y}`;
  const targetKey = `${target.x},${target.y}`;
  if (startKey === targetKey) return null;

  return bfs(playerPosition, (key) => key === targetKey, walkableKnown, targetKey);
}

/**
 * BFS toward the nearest frontier cell — a known walkable cell adjacent to unexplored territory.
 * "Unexplored" = position not present in view.map.cells (since hidden cells are excluded).
 * This drives systematic exploration of the dungeon.
 */
export function pathfindToFrontier(view: GameView): GameCommand | null {
  if (!view.map) return null;
  const { cells, playerPosition } = view.map;

  // Build set of ALL known positions (walls + walkable, visible + remembered)
  const allKnown = new Set<string>();
  const walkableKnown = new Set<string>();

  for (const cell of cells) {
    const key = `${cell.x},${cell.y}`;
    allKnown.add(key);
    if (cell.walkable) walkableKnown.add(key);
  }

  // Frontier: walkable known cells with at least one neighbor not in allKnown
  const frontier = new Set<string>();
  for (const key of walkableKnown) {
    const [xs, ys] = key.split(',');
    const x = parseInt(xs!, 10);
    const y = parseInt(ys!, 10);
    for (const { dx, dy } of DIRS8) {
      if (!allKnown.has(`${x + dx},${y + dy}`)) {
        frontier.add(key);
        break;
      }
    }
  }

  if (frontier.size === 0) return null; // Fully explored

  return bfs(playerPosition, (key) => frontier.has(key), walkableKnown, null);
}

/**
 * BFS toward the nearest visible enemy.
 * Returns a MOVE command toward the closest enemy by Chebyshev distance,
 * or null if no enemies visible or already adjacent.
 */
/**
 * BFS toward the nearest visible enemy.
 * Returns a MOVE command toward the closest enemy by Chebyshev distance,
 * or null if no enemies visible or already adjacent.
 */
export function pathfindToEnemy(view: GameView): GameCommand | null {
  if (!view.map?.entities) return null;

  // Extract all visible enemies
  const enemies = view.map.entities.filter((e) => e.type === 'enemy');
  if (enemies.length === 0) return null;

  const playerPos = view.map.playerPosition;

  // Find nearest enemy by Chebyshev distance
  let nearest: { entity: typeof enemies[0]; dist: number } | null = null;
  for (const entity of enemies) {
    const dx = Math.abs(entity.x - playerPos.x);
    const dy = Math.abs(entity.y - playerPos.y);
    const dist = Math.max(dx, dy);
    
    if (!nearest || dist < nearest.dist) {
      nearest = { entity, dist };
    }
  }

  // If nearest enemy is adjacent, no approach needed (attack will handle it)
  if (!nearest || nearest.dist <= 1) return null;

  // Build set of known walkable cells
  const walkableKnown = new Set<string>();
  for (const cell of view.map.cells) {
    if (cell.walkable) walkableKnown.add(`${cell.x},${cell.y}`);
  }

  // BFS toward the nearest enemy
  const targetKey = `${nearest.entity.x},${nearest.entity.y}`;
  return bfs(playerPos, (key) => key === targetKey, walkableKnown, targetKey);
}

/** Generic BFS from start toward a goal predicate through walkableKnown cells. */
export function bfs(
  start: { x: number; y: number },
  isGoal: (key: string) => boolean,
  walkable: Set<string>,
  alsoAllow: string | null, // extra target key to allow even if not in walkable
): GameCommand | null {
  const startKey = `${start.x},${start.y}`;
  if (isGoal(startKey)) return null;

  const queue: BfsNode[] = [];
  const visited = new Set<string>([startKey]);

  for (const { dx, dy, dir } of DIRS8) {
    const nx = start.x + dx;
    const ny = start.y + dy;
    const key = `${nx},${ny}`;
    if ((walkable.has(key) || key === alsoAllow) && !visited.has(key)) {
      visited.add(key);
      queue.push({ x: nx, y: ny, firstDir: dir });
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    const key = `${node.x},${node.y}`;

    if (isGoal(key)) {
      return { type: 'MOVE', direction: node.firstDir };
    }

    for (const { dx, dy } of DIRS8) {
      const nx = node.x + dx;
      const ny = node.y + dy;
      const nextKey = `${nx},${ny}`;
      if ((walkable.has(nextKey) || nextKey === alsoAllow) && !visited.has(nextKey)) {
        visited.add(nextKey);
        queue.push({ x: nx, y: ny, firstDir: node.firstDir });
      }
    }
  }

  return null;
}
