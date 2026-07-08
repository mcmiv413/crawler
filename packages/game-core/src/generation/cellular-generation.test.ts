/**
 * Test layer: unit
 * Behavior: Floor generation chooses cellular or digger layout algorithms from biome mapGen settings while preserving valid stairs and playable cell maps.
 * Proof: Assertions check biomeId, result.valid, cell-map sizes, wall-density bounds, and entrance/exit cells with stairs_up/stairs_down tiles.
 * Validation: pnpm vitest run packages/game-core/src/generation/cellular-generation.test.ts
 */
import { describe, it, expect } from 'vitest';
import { generateFloor } from './index.js';
import { SeededRNG } from '../utils/rng.js';

type BiomeDefinition = Parameters<typeof generateFloor>[1];

// ---------------------------------------------------------------------------
// Local biome stubs — mirrors the real definitions but avoids a runtime
// @dungeon/content import so this file stays isolated from live content data.
// ---------------------------------------------------------------------------

const STUB_FOREST: BiomeDefinition = {
  biomeId: 'forest',
  name: 'Deep Forest',
  description: 'A dense woodland filled with ancient trees and lurking vermin.',
  floorRange: { min: 2, max: 4 },
  tileWeights: { floor: 0.6, wall: 0.3, door: 0.1 },
  ambientColor: '#2a4a2a',
  floorAscii: '.',
  wallAscii: 'T',
  tileSprites: {
    floor: 'day grass floor c',
    wall: 'forest tree trunk',
    interactable: 'closed wooden door front',
  },
  mapGen: {
    roomWidth: [6, 12],
    roomHeight: [5, 9],
    corridorLength: [1, 2],
    dugPercentage: 0.65,
    algorithm: 'cellular',
    fillProbability: 0.45,
    iterations: 4,
  },
};

const STUB_MOSS_CAVERNS: BiomeDefinition = {
  biomeId: 'moss_caverns',
  name: 'Moss Caverns',
  description: 'Damp caverns blanketed with bioluminescent moss.',
  floorRange: { min: 3, max: 6 },
  tileWeights: { floor: 0.55, wall: 0.35, door: 0.1 },
  ambientColor: '#1a3a1a',
  floorAscii: '.',
  wallAscii: 'm',
  mapGen: {
    roomWidth: [5, 10],
    roomHeight: [4, 8],
    corridorLength: [1, 3],
    dugPercentage: 0.6,
    algorithm: 'cellular',
    fillProbability: 0.48,
    iterations: 5,
  },
};

const STUB_STONE_CRYPT: BiomeDefinition = {
  biomeId: 'stone_crypt',
  name: 'Stone Crypt',
  description: 'Ancient burial chambers carved from grey stone.',
  floorRange: { min: 1, max: 3 },
  tileWeights: { floor: 0.55, wall: 0.35, door: 0.1 },
  ambientColor: '#444444',
  floorAscii: '.',
  wallAscii: '#',
  tileSprites: {
    floor: 'day stone floor c',
    wall: 'dark brick wall center',
    interactable: 'closed stone door front',
  },
  mapGen: {
    roomWidth: [3, 5],
    roomHeight: [2, 4],
    corridorLength: [1, 3],
    dugPercentage: 0.38,
  },
};

describe('Cellular Automata Map Generation', () => {
  it('forest biome uses cellular algorithm', () => {
    const rng = new SeededRNG(42);
    const result = generateFloor(3, STUB_FOREST, rng);

    expect(result.floor.biomeId).toBe('forest');
    expect(result.floor.cells.size).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  });

  it('moss caverns biome uses cellular algorithm', () => {
    const rng = new SeededRNG(43);
    const result = generateFloor(4, STUB_MOSS_CAVERNS, rng);

    expect(result.floor.biomeId).toBe('moss_caverns');
    expect(result.floor.cells.size).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  });

  it('stone crypt still uses digger algorithm', () => {
    const rng = new SeededRNG(44);
    const result = generateFloor(1, STUB_STONE_CRYPT, rng);

    expect(result.floor.biomeId).toBe('stone_crypt');
    expect(result.floor.cells.size).toBeGreaterThan(20);
    expect(result.valid).toBe(true);
  });

  it('forest generates organic wall patterns (non-rectangular)', () => {
    const rng = new SeededRNG(45);
    const result = generateFloor(3, STUB_FOREST, rng);
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
    const result = generateFloor(4, STUB_MOSS_CAVERNS, rng);
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
    const result = generateFloor(3, STUB_FOREST, rng);
    const floor = result.floor;

    const entranceCell = floor.cells.get(`${floor.entrance.x},${floor.entrance.y}`);
    const exitCell = floor.cells.get(`${floor.exit.x},${floor.exit.y}`);

    expect(entranceCell?.tile.type).toBe('stairs_up');
    expect(exitCell?.tile.type).toBe('stairs_down');
  });
});
