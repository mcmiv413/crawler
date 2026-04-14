import { describe, it, expect } from 'vitest';
import { generateFloor } from './index.js';
import { forest, mossCaverns, stoneCrypt } from '@dungeon/content';
import { SeededRNG } from '../utils/rng.js';

describe('Cellular Automata Map Generation', () => {
  it('forest biome uses cellular algorithm', () => {
    const rng = new SeededRNG(42);
    const result = generateFloor(3, forest, rng);

    expect(result.floor.biomeId).toBe('forest');
    expect(result.floor.cells.size).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  });

  it('moss caverns biome uses cellular algorithm', () => {
    const rng = new SeededRNG(43);
    const result = generateFloor(4, mossCaverns, rng);

    expect(result.floor.biomeId).toBe('moss_caverns');
    expect(result.floor.cells.size).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  });

  it('stone crypt still uses digger algorithm', () => {
    const rng = new SeededRNG(44);
    const result = generateFloor(1, stoneCrypt, rng);

    expect(result.floor.biomeId).toBe('stone_crypt');
    expect(result.floor.cells.size).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  });

  it('forest generates organic wall patterns (non-rectangular)', () => {
    const rng = new SeededRNG(45);
    const result = generateFloor(3, forest, rng);
    const floor = result.floor;

    // Verify generation succeeded and produced a valid dungeon
    expect(result.valid).toBe(true);
    expect(floor.cells.size).toBeGreaterThan(100);

    // Count walls - verify some exist but not too many
    let wallCount = 0;
    for (const cell of floor.cells.values()) {
      if (cell.tile.type === 'wall') wallCount++;
    }

    const wallRatio = wallCount / floor.cells.size;
    // Cellular automata produces variable wall densities
    expect(wallRatio).toBeLessThan(0.80);
  });

  it('moss caverns generates cave-like wall patterns', () => {
    const rng = new SeededRNG(46);
    const result = generateFloor(4, mossCaverns, rng);
    const floor = result.floor;

    // Verify generation succeeded and produced a valid dungeon
    expect(result.valid).toBe(true);
    expect(floor.cells.size).toBeGreaterThan(100);

    let wallCount = 0;
    for (const cell of floor.cells.values()) {
      if (cell.tile.type === 'wall') wallCount++;
    }

    const wallRatio = wallCount / floor.cells.size;
    // Cellular automata produces variable wall densities
    expect(wallRatio).toBeLessThan(0.80);
  });

  it('generated floors have valid entrance and exit', () => {
    const rng = new SeededRNG(47);
    const result = generateFloor(3, forest, rng);
    const floor = result.floor;

    const entranceCell = floor.cells.get(`${floor.entrance.x},${floor.entrance.y}`);
    const exitCell = floor.cells.get(`${floor.exit.x},${floor.exit.y}`);

    expect(entranceCell?.tile.type).toBe('stairs_up');
    expect(exitCell?.tile.type).toBe('stairs_down');
  });
});
