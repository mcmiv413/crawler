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

  const run = state.run;
  const playerPos = state.player.position;
  const floor = run.floor;
  const directions: Array<'N' | 'S' | 'E' | 'W' | 'NE' | 'NW' | 'SE' | 'SW'> = ['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'];

  return directions
    .map(direction => moveInDirection(playerPos, direction))
    .filter(position => position.x >= 0 && position.x < floor.width && position.y >= 0 && position.y < floor.height)
    .filter((position) => {
      const cell = floor.cells.get(`${position.x},${position.y}`);
      return cell !== undefined && cell.tile.walkable === true;
    })
    .filter(position => !run.objects.has(`${position.x},${position.y}`))
    .filter(position =>
      !Array.from(run.enemies.values()).some(enemy =>
        enemy.position.x === position.x && enemy.position.y === position.y,
      ),
    );
}
