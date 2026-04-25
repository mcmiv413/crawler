import { describe, it, expect } from 'vitest';
import { findPath } from './pathfinding.js';

interface MapCellView {
  readonly x: number;
  readonly y: number;
  readonly ascii: string;
  readonly color: string;
  readonly bgColor: string;
  readonly visibility: 'visible' | 'remembered' | 'hidden';
  readonly walkable: boolean;
  readonly tileType: 'floor';
}

interface EntityView {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly ascii: string;
  readonly color: string;
  readonly name: string;
  readonly type: 'enemy';
  readonly health: number;
  readonly maxHealth: number;
  readonly templateId: string;
}

interface MapView {
  readonly width: number;
  readonly height: number;
  readonly cells: readonly MapCellView[];
  readonly entities: readonly EntityView[];
  readonly playerPosition: { readonly x: number; readonly y: number };
  readonly biomeId: string;
  readonly dangerLevel: 'moderate';
}

function makeCell(x: number, y: number, walkable = true, visibility: 'visible' | 'remembered' | 'hidden' = 'visible'): MapCellView {
  return { x, y, ascii: '.', color: '#fff', bgColor: '#000', visibility, walkable, tileType: 'floor' };
}

function makeEnemy(id: string, x: number, y: number): EntityView {
  return { id, x, y, ascii: 'E', color: '#f00', name: 'Enemy', type: 'enemy', health: 10, maxHealth: 10, templateId: 'rat' };
}

function makeMap(cells: MapCellView[], entities: EntityView[] = []): MapView {
  return {
    width: 10, height: 10, cells, entities,
    playerPosition: { x: 0, y: 0 }, biomeId: 'crypt', dangerLevel: 'moderate',
  };
}

describe('findPath (shared @dungeon/core)', () => {
  it('returns empty array when start === destination', () => {
    const map = makeMap([makeCell(0, 0)]);
    expect(findPath(map, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual([]);
  });

  it('finds straight-line path on open grid', () => {
    const cells = [];
    for (let x = 0; x <= 3; x++) cells.push(makeCell(x, 0));
    const map = makeMap(cells);
    const path = findPath(map, { x: 0, y: 0 }, { x: 3, y: 0 });
    expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }]);
  });

  it('routes around walls (non-walkable cells)', () => {
    const cells = [
      makeCell(0, 0), makeCell(1, 0, false), makeCell(2, 0),
      makeCell(0, 1), makeCell(1, 1), makeCell(2, 1),
    ];
    const map = makeMap(cells);
    const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    expect(path.some(p => p.x === 1 && p.y === 0)).toBe(false);
  });

  it('routes around enemy-occupied cells', () => {
    const cells = [
      makeCell(0, 0), makeCell(1, 0), makeCell(2, 0),
      makeCell(0, 1), makeCell(1, 1), makeCell(2, 1),
    ];
    const enemy = makeEnemy('e1', 1, 0);
    const map = makeMap(cells, [enemy]);
    const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path.length).toBeGreaterThan(0);
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
    expect(path.some(p => p.x === 1 && p.y === 0)).toBe(false);
  });

  it('handles 8-directional movement (diagonal paths)', () => {
    const cells = [makeCell(0, 0), makeCell(1, 1)];
    const map = makeMap(cells);
    const path = findPath(map, { x: 0, y: 0 }, { x: 1, y: 1 });
    expect(path).toEqual([{ x: 1, y: 1 }]);
  });

  it('returns empty array when no path exists (walled off)', () => {
    const cells = [
      makeCell(0, 0), makeCell(1, 0, false), makeCell(2, 0, false),
      makeCell(0, 1, false), makeCell(1, 1, false), makeCell(2, 1, false),
      makeCell(0, 2, false), makeCell(1, 2, false), makeCell(2, 2),
    ];
    const map = makeMap(cells);
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 2 })).toEqual([]);
  });

  it('uses visible and remembered cells but ignores hidden', () => {
    const cells = [
      makeCell(0, 0, true, 'visible'),
      makeCell(1, 0, true, 'remembered'),
      makeCell(2, 0, true, 'visible'),
    ];
    const map = makeMap(cells);
    const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path).toEqual([{ x: 1, y: 0 }, { x: 2, y: 0 }]);
  });

  it('cannot path through hidden cells', () => {
    const cells = [
      makeCell(0, 0, true, 'visible'),
      makeCell(1, 0, true, 'hidden'),
      makeCell(2, 0, true, 'visible'),
    ];
    const map = makeMap(cells);
    expect(findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 })).toEqual([]);
  });

  it('returns path excluding start, including destination', () => {
    const cells = [makeCell(0, 0), makeCell(1, 0), makeCell(2, 0)];
    const map = makeMap(cells);
    const path = findPath(map, { x: 0, y: 0 }, { x: 2, y: 0 });
    expect(path[0]).toEqual({ x: 1, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 2, y: 0 });
  });
});
