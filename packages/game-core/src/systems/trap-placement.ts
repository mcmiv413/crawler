import type { GameState } from '@dungeon/contracts';
import { moveInDirection } from '../utils/grid.js';

/**
 * Get valid adjacent directions for trap placement.
 * Returns array of directions that are walkable, not occupied by objects or enemies,
 * and within map bounds.
 */
export function getValidTrapPlacementDirections(
  state: GameState,
): Array<{ readonly x: number; readonly y: number }> {
  if (state.run === null) return [];

  const playerPos = state.player.position;
  const floor = state.run.floor;
  const mutableValidDirections: Array<{ readonly x: number; readonly y: number }> = [];
  const directions: Array<'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW'> = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];

  for (const direction of directions) {
    const position = moveInDirection(playerPos, direction);

    if (position.x < 0 || position.x >= floor.width || position.y < 0 || position.y >= floor.height) {
      continue;
    }

    const cell = floor.cells.get(`${position.x},${position.y}`);
    if (cell === undefined || cell.tile.walkable !== true) {
      continue;
    }

    if (state.run.objects.has(`${position.x},${position.y}`)) {
      continue;
    }

    let hasEnemy = false;
    for (const enemy of state.run.enemies.values()) {
      if (enemy.position.x === position.x && enemy.position.y === position.y) {
        hasEnemy = true;
        break;
      }
    }

    if (hasEnemy === true) {
      continue;
    }

    mutableValidDirections.push(position);
  }

  return mutableValidDirections;
}
