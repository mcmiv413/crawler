/**
 * Test layer: unit
 * Behavior: map Generator covers Map Generation; generates a floor with entrance and exit; floor cells exist and are a Map.
 * Proof: focused assertions verify returned values, state changes, rendered output, or emitted events.
 * Validation: pnpm vitest run packages/game-core/src/generation/map-generator.test.ts
 */
import { describe, it, expect } from 'vitest';
import { generateFloor, bfsReachable } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';

type BiomeDefinition = Parameters<typeof generateFloor>[1];

const STUB_BIOME: BiomeDefinition = {
  biomeId: 'stub',
  name: 'Stub',
  description: 'Test stub biome',
  floorRange: { min: 1, max: 5 },
  tileWeights: { floor: 0.55, wall: 0.35, door: 0.1 },
  ambientColor: '#444444',
  floorAscii: '.',
  wallAscii: '#',
  mapGen: {
    roomWidth: [3, 5],
    roomHeight: [2, 4],
    corridorLength: [1, 3],
    dugPercentage: 0.38,
  },
};

const STUB_BIOME_B: BiomeDefinition = {
  biomeId: 'stub_b',
  name: 'Stub B',
  description: 'Test stub biome B with different mapGen params',
  floorRange: { min: 1, max: 5 },
  tileWeights: { floor: 0.6, wall: 0.3, door: 0.1 },
  ambientColor: '#336633',
  floorAscii: ',',
  wallAscii: 'T',
  mapGen: {
    roomWidth: [5, 9],
    roomHeight: [4, 7],
    corridorLength: [2, 5],
    dugPercentage: 0.5,
  },
};

describe('Map Generation', () => {
  it('generates a floor with entrance and exit', () => {
    const rng = new SeededRNG(42);
    const { floor, valid } = generateFloor(3, STUB_BIOME, rng);

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
    const { floor } = generateFloor(1, STUB_BIOME, rng);
    expect(floor.cells).toBeInstanceOf(Map);
    expect(floor.cells.size).toBeGreaterThan(0);
  });

  it('bfsReachable returns true for connected positions', () => {
    const rng = new SeededRNG(456);
    const { floor } = generateFloor(1, STUB_BIOME, rng);
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
    const { floor: floor1 } = generateFloor(1, STUB_BIOME, rng1);

    const rng2 = new SeededRNG(8888);
    const { floor: floor2 } = generateFloor(1, STUB_BIOME, rng2);

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

  it('mapGen params are applied to floor generation', () => {
    // Same seed, different biomes should produce different layouts due to mapGen
    const rng1 = new SeededRNG(42);
    const { floor: floorA } = generateFloor(2, STUB_BIOME, rng1);
    const rng2 = new SeededRNG(42);
    const { floor: floorB } = generateFloor(2, STUB_BIOME_B, rng2);

    // With different mapGen params, the layouts should differ
    // Most likely the floor sizes or entrance/exit positions will differ
    const entranceA = `${floorA.entrance.x},${floorA.entrance.y}`;
    const entranceB = `${floorB.entrance.x},${floorB.entrance.y}`;

    // At least the entrance should differ (with high probability)
    const layoutDiffers = entranceA !== entranceB || floorA.cells.size !== floorB.cells.size;
    expect(layoutDiffers).toBe(true);
  });
});
