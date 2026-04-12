import type { Position, TileType, Visibility } from './common.js';

export interface Tile {
  readonly type: TileType;
  readonly walkable: boolean;
  readonly blocksVision: boolean;
  readonly ascii: string;
  readonly color: string;
}

export interface MapCell {
  readonly tile: Tile;
  readonly visibility: Visibility;
}

export interface DungeonFloor {
  readonly width: number;
  readonly height: number;
  readonly depth: number;
  readonly biomeId: string;
  readonly cells: ReadonlyMap<string, MapCell>;
  readonly entrance: Position;
  readonly exit: Position;
  readonly seed: number;
}

/** Convert position to map key */
export function posKey(pos: Position): string {
  return `${pos.x},${pos.y}`;
}
