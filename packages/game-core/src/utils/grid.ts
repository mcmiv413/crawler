import type { Position, Direction } from '@dungeon/contracts';
import { DIRECTION_VECTORS } from '@dungeon/contracts';

/** Manhattan distance between two positions */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/** Chebyshev distance (8-directional) between two positions */
export function chebyshevDistance(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}

/** Move a position in a direction */
export function moveInDirection(pos: Position, dir: Direction): Position {
  const delta = DIRECTION_VECTORS[dir];
  return { x: pos.x + delta.x, y: pos.y + delta.y };
}

/** Check if two positions are equal */
export function positionsEqual(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Get all 8 neighboring positions */
export function getNeighbors(pos: Position): Position[] {
  return Object.values(DIRECTION_VECTORS).map(d => ({
    x: pos.x + d.x,
    y: pos.y + d.y,
  }));
}

/** String key to position */
export function keyToPosition(key: string): Position {
  const [x, y] = key.split(',').map(Number);
  return { x: x!, y: y! };
}
