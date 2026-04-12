import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { generateFloor, bfsReachable } from './map-generator.js';
import { SeededRNG } from '../utils/rng.js';
import { stoneCrypt, goblinWarrens, mossCaverns } from '@dungeon/content';
import { posKey } from '@dungeon/contracts';

const biomes = [stoneCrypt, goblinWarrens, mossCaverns];

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
          const { floor } = generateFloor(1, stoneCrypt, rng);
          expect(posKey(floor.entrance)).not.toBe(posKey(floor.exit));
        },
      ),
      { numRuns: 50 },
    );
  });
});
