import { FOV } from 'rot-js';
import type { Position, DungeonFloor, MapCell } from '@dungeon/contracts';
import { posKey } from '@dungeon/contracts';
import { VISION } from '@dungeon/content';

/** Compute FOV from a position and update map cell visibility */
export function computeFov(
  floor: DungeonFloor,
  viewerPos: Position,
  radius: number = VISION.baseRadius,
): ReadonlyMap<string, MapCell> {
  const updatedCells = new Map(floor.cells);

  // First, set all previously visible cells to "remembered"
  for (const [key, cell] of updatedCells) {
    if (cell.visibility === 'visible') {
      updatedCells.set(key, { ...cell, visibility: 'remembered' });
    }
  }

  // Compute new FOV
  const fov = new FOV.PreciseShadowcasting((x, y) => {
    const key = posKey({ x, y });
    const cell = floor.cells.get(key);
    return cell !== undefined ? !cell.tile.blocksVision : false;
  });

  fov.compute(viewerPos.x, viewerPos.y, radius, (x, y, _r, visibility) => {
    if (visibility <= 0) return;
    const key = posKey({ x, y });
    const cell = updatedCells.get(key);
    if (cell !== undefined) {
      updatedCells.set(key, { ...cell, visibility: 'visible' });
    }
  });

  return updatedCells;
}
