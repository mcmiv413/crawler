/**
 * Direction utility re-exported from web layer for backwards compatibility.
 * Originally at @dungeon/core/utils/direction, kept here for web imports.
 */
import type { Direction } from '@dungeon/contracts';

interface Position {
  readonly x: number;
  readonly y: number;
}

const DIR_MAP: Record<string, Direction> = {
  '0,-1': 'N',
  '0,1': 'S',
  '1,0': 'E',
  '-1,0': 'W',
  '1,-1': 'NE',
  '-1,-1': 'NW',
  '1,1': 'SE',
  '-1,1': 'SW',
};

export function positionToDirection(from: Position, to: Position): Direction | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return DIR_MAP[`${dx},${dy}`] ?? null;
}

