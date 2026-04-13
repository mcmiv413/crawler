import type { Position, Direction, GameState } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { moveInDirection, positionsEqual } from '../utils/grid.js';

export interface MoveValidation {
  readonly valid: boolean;
  readonly reason?: string;
  readonly newPosition?: Position;
}

/** Validate and compute a movement */
export function validateMove(state: GameState, direction: Direction): MoveValidation {
  // Validate direction is one of the valid directions
  const validDirections = new Set(['N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW']);
  if (!validDirections.has(direction)) {
    return { valid: false, reason: 'Invalid direction' };
  }

  if (state.run === null) {
    return { valid: false, reason: 'Not in a dungeon run' };
  }

  const newPos = moveInDirection(state.player.position, direction);
  const key = posKey(newPos);
  const cell = state.run.floor.cells.get(key);

  if (cell === undefined) {
    return { valid: false, reason: 'Out of bounds' };
  }

  if (cell.tile.walkable !== true) {
    return { valid: false, reason: 'Tile is not walkable' };
  }

  // Check if an enemy occupies the target position
  for (const enemy of state.run.enemies.values()) {
    if (positionsEqual(enemy.position, newPos)) {
      return { valid: false, reason: 'Tile occupied by enemy' };
    }
  }

  return { valid: true, newPosition: newPos };
}

/** Check if a position is walkable and unoccupied */
export function isWalkable(state: GameState, pos: Position): boolean {
  if (state.run === null) return false;
  const cell = state.run.floor.cells.get(posKey(pos));
  if (cell === undefined || cell.tile.walkable !== true) return false;

  // Check enemy positions
  for (const enemy of state.run.enemies.values()) {
    if (positionsEqual(enemy.position, pos)) return false;
  }

  // Check player position
  if (positionsEqual(state.player.position, pos)) return false;

  return true;
}
