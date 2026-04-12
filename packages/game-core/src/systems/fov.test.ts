import { describe, it, expect } from 'vitest';
import { computeFov } from './fov.js';
import { posKey } from '@dungeon/contracts';
import type { DungeonFloor, MapCell } from '@dungeon/contracts';

const FLOOR_TILE: MapCell = {
  tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' },
  visibility: 'hidden',
};

const WALL_TILE: MapCell = {
  tile: { type: 'wall', walkable: false, blocksVision: true, ascii: '#', color: '#666' },
  visibility: 'hidden',
};

function makeFloor(width: number, height: number, walls?: { x: number; y: number }[]): DungeonFloor {
  const cells = new Map<string, MapCell>();
  const wallSet = new Set((walls ?? []).map(w => posKey(w)));
  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const key = posKey({ x, y });
      cells.set(key, wallSet.has(key) ? { ...WALL_TILE } : { ...FLOOR_TILE });
    }
  }
  return {
    width, height, depth: 1, biomeId: 'crypt',
    cells, entrance: { x: 0, y: 0 }, exit: { x: width - 1, y: height - 1 }, seed: 42,
  };
}

describe('computeFov', () => {
  it('open room: tiles within radius are visible', () => {
    const floor = makeFloor(10, 10);
    const result = computeFov(floor, { x: 5, y: 5 }, 3);

    // Viewer's own tile should be visible
    expect(result.get('5,5')!.visibility).toBe('visible');
    // Adjacent tile within radius
    expect(result.get('6,5')!.visibility).toBe('visible');
    // Tile at distance 3
    expect(result.get('8,5')!.visibility).toBe('visible');
  });

  it('wall blocks vision behind it', () => {
    // Wall at (3, 0), viewer at (0, 0)
    const floor = makeFloor(10, 1, [{ x: 3, y: 0 }]);
    const result = computeFov(floor, { x: 0, y: 0 }, 8);

    // Before wall: visible
    expect(result.get('2,0')!.visibility).toBe('visible');
    // Behind wall: should be hidden (blocked by wall)
    expect(result.get('4,0')!.visibility).toBe('hidden');
  });

  it('previously visible tile becomes remembered after moving away', () => {
    const floor = makeFloor(20, 1);
    // First compute from position 0 with radius 3
    const first = computeFov(floor, { x: 0, y: 0 }, 3);
    expect(first.get('2,0')!.visibility).toBe('visible');

    // Now compute from position 10 (far away) — pass the updated floor
    const updatedFloor = { ...floor, cells: first };
    const second = computeFov(updatedFloor, { x: 10, y: 0 }, 3);

    // Position 2 was previously visible, should now be remembered
    expect(second.get('2,0')!.visibility).toBe('remembered');
    // Position 10 (new location) should be visible
    expect(second.get('10,0')!.visibility).toBe('visible');
  });

  it('custom radius parameter limits vision range', () => {
    const floor = makeFloor(20, 1);
    const result = computeFov(floor, { x: 0, y: 0 }, 2);

    // Within radius 2: visible
    expect(result.get('2,0')!.visibility).toBe('visible');
    // Beyond radius 2: hidden
    expect(result.get('5,0')!.visibility).toBe('hidden');
  });
});
