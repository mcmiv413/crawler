import { describe, it, expect } from 'vitest';
import { generateFloor, bfsReachable } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';
import { stoneCrypt } from '@dungeon/content';
import { posKey } from '@dungeon/contracts';

describe('Map Generation', () => {
  it('generates a floor with entrance and exit', () => {
    const rng = new SeededRNG(42);
    const { floor, valid } = generateFloor(3, stoneCrypt, rng);

    expect(valid).toBe(true);
    expect(floor.entrance).toBeDefined();
    expect(floor.exit).toBeDefined();

    // Entrance and exit are Position objects {x, y}
    expect(floor.entrance.x).toBeGreaterThanOrEqual(0);
    expect(floor.entrance.x).toBeLessThan(floor.width);
    expect(floor.entrance.y).toBeGreaterThanOrEqual(0);
    expect(floor.entrance.y).toBeLessThan(floor.height);
    expect(floor.exit.x).toBeGreaterThanOrEqual(0);
    expect(floor.exit.x).toBeLessThan(floor.width);
  });

  it('floor cells exist and are a Map', () => {
    const rng = new SeededRNG(123);
    const { floor } = generateFloor(1, stoneCrypt, rng);
    expect(floor.cells).toBeInstanceOf(Map);
    expect(floor.cells.size).toBeGreaterThan(0);
  });

  it('bfsReachable returns true for connected positions', () => {
    const rng = new SeededRNG(456);
    const { floor } = generateFloor(1, stoneCrypt, rng);
    expect(bfsReachable(floor.cells, floor.entrance, floor.exit)).toBe(true);
  });

  it('bfsReachable returns false for disconnected positions', () => {
    // Create a tiny map with a wall separating two floor tiles
    const cells = new Map();
    cells.set('0,0', { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' });
    cells.set('1,0', { tile: { type: 'wall', walkable: false, blocksVision: true, ascii: '#', color: '#666' }, visibility: 'hidden' });
    cells.set('2,0', { tile: { type: 'floor', walkable: true, blocksVision: false, ascii: '.', color: '#aaa' }, visibility: 'hidden' });
    expect(bfsReachable(cells, { x: 0, y: 0 }, { x: 2, y: 0 })).toBe(false);
  });

  it('generates valid floor with multiple seeds', () => {
    // Verify that floor generation works with different seeds
    const rng1 = new SeededRNG(9999);
    const { floor: floor1 } = generateFloor(1, stoneCrypt, rng1);

    const rng2 = new SeededRNG(8888);
    const { floor: floor2 } = generateFloor(1, stoneCrypt, rng2);

    // Both should generate valid floor structures
    expect(floor1.entrance).toBeDefined();
    expect(floor1.exit).toBeDefined();
    expect(floor1.cells.size).toBeGreaterThan(0);

    expect(floor2.entrance).toBeDefined();
    expect(floor2.exit).toBeDefined();
    expect(floor2.cells.size).toBeGreaterThan(0);

    // With high probability, different seeds generate different layouts
    const entranceSame = floor1.entrance.x === floor2.entrance.x && floor1.entrance.y === floor2.entrance.y;
    const exitSame = floor1.exit.x === floor2.exit.x && floor1.exit.y === floor2.exit.y;
    const sizeSame = floor1.cells.size === floor2.cells.size;
    const different = !entranceSame || !exitSame || !sizeSame;
    expect(different).toBe(true);
  });
});
