/**
 * Test layer: property
 * Behavior: map Generator covers map-generator property tests; should produce valid connected maps for 100 random seeds; entrance and exit should be distinct positions.
 * Proof: seeded/generated cases preserve the invariant under varied inputs.
 * Validation: pnpm vitest run packages/game-core/src/generation/map-generator.property.test.ts
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateFloor, bfsReachable } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';
import { posKey } from '@dungeon/contracts';

type BiomeDefinition = Parameters<typeof generateFloor>[1];

const STUB_BIOME_A: BiomeDefinition = {
  biomeId: 'stub_a',
  name: 'Stub A',
  description: 'Test stub biome A',
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
  description: 'Test stub biome B',
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

const STUB_BIOME_C: BiomeDefinition = {
  biomeId: 'stub_c',
  name: 'Stub C',
  description: 'Test stub biome C',
  floorRange: { min: 1, max: 5 },
  tileWeights: { floor: 0.5, wall: 0.4, door: 0.1 },
  ambientColor: '#334433',
  floorAscii: '~',
  wallAscii: 'o',
  mapGen: {
    roomWidth: [4, 7],
    roomHeight: [3, 6],
    corridorLength: [1, 4],
    dugPercentage: 0.45,
  },
};

const biomes = [STUB_BIOME_A, STUB_BIOME_B, STUB_BIOME_C];

describe('map-generator property tests', () => {
  it('should produce valid connected maps for 100 random seeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 0, max: biomes.length - 1 }),
        fc.integer({ min: 1, max: 5 }),
        (seed, biomeIdx, depth) => {
          const rng = new SeededRNG(seed);
          const biome = biomes[biomeIdx]!;
          const { floor, valid } = generateFloor(depth, biome, rng);

          // Map should be valid (generator retries up to 3x + uniform fallback)
          expect(valid).toBe(true);

          // Floor should have reasonable dimensions
          expect(floor.width).toBeGreaterThanOrEqual(10);
          expect(floor.height).toBeGreaterThanOrEqual(10);

          // Entrance and exit should exist as cells
          const entranceCell = floor.cells.get(posKey(floor.entrance));
          const exitCell = floor.cells.get(posKey(floor.exit));
          expect(entranceCell).toBeDefined();
          expect(exitCell).toBeDefined();

          // Entrance and exit should be walkable
          expect(entranceCell!.tile.walkable).toBe(true);
          expect(exitCell!.tile.walkable).toBe(true);

          // Entrance should reach exit via BFS
          expect(bfsReachable(floor.cells, floor.entrance, floor.exit)).toBe(true);

          // Should have at least some floor tiles
          let floorCount = 0;
          for (const cell of floor.cells.values()) {
            if (cell.tile.walkable) floorCount++;
          }
          expect(floorCount).toBeGreaterThanOrEqual(10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('entrance and exit should be distinct positions', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100_000 }),
        (seed) => {
          const rng = new SeededRNG(seed);
          const { floor } = generateFloor(1, STUB_BIOME_A, rng);
          expect(posKey(floor.entrance)).not.toBe(posKey(floor.exit));
        },
      ),
      { numRuns: 50 },
    );
  });
});
